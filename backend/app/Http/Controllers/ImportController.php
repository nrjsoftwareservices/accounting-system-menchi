<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ImportController extends Controller
{
    public function importAccounts(Request $request)
    {
        $org = $request->attributes->get('organization');
        $request->validate(['file' => 'required|file|mimes:csv,txt']);
        $path = $request->file('file')->getRealPath();
        $handle = fopen($path, 'r');
        if (!$handle) return response()->json(['message' => 'Unable to read file'], 400);

        // Read and normalize header (strip BOM, spaces, punctuation)
        $header = fgetcsv($handle);
        $normalize = function(string $s) {
            // Remove UTF-8 BOM if present
            $s = preg_replace('/^\xEF\xBB\xBF/', '', $s);
            $s = strtolower(trim($s));
            $s = preg_replace('/[^a-z0-9]+/', '_', $s);
            return trim($s, '_');
        };
        $cols = array_map($normalize, $header ?: []);
        // Expected columns: code,name,type,parent_code
        $count = 0; $errors = [];
        DB::beginTransaction();
        try {
            while (($row = fgetcsv($handle)) !== false) {
                $data = array_combine($cols, array_pad($row, count($cols), null));
                if (!$data) continue;
                $code = (string)($data['code'] ?? '');
                $name = (string)($data['name'] ?? '');
                $type = (string)($data['type'] ?? '');
                $parentCode = (string)($data['parent_code'] ?? '');
                if ($code === '' || $name === '' || $type === '') { continue; }

                $parentId = null;
                if ($parentCode !== '') {
                    $parent = Account::where('organization_id', $org->id)->where('code', $parentCode)->first();
                    $parentId = $parent?->id;
                }
                Account::updateOrCreate(
                    ['organization_id' => $org->id, 'code' => $code],
                    [
                        'name' => $name,
                        'type' => $type,
                        'parent_id' => $parentId,
                        'level' => $parentId ? 2 : 1,
                        'is_active' => true,
                    ]
                );
                $count++;
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            $errors[] = $e->getMessage();
        } finally { fclose($handle); }

        return response()->json(['imported' => $count, 'errors' => $errors]);
    }

    public function importJournals(Request $request)
    {
        $org = $request->attributes->get('organization');
        $request->validate(['file' => 'required|file|mimes:csv,txt']);
        $path = $request->file('file')->getRealPath();
        $handle = fopen($path, 'r');
        if (!$handle) return response()->json(['message' => 'Unable to read file'], 400);

        // Read all rows first for flexible header detection
        $allRows = [];
        while (($row = fgetcsv($handle)) !== false) { $allRows[] = $row; }
        fclose($handle);

        $normalize = function(string $s) {
            $s = strtolower(trim($s));
            $s = preg_replace('/[^a-z0-9]+/','_', $s);
            return trim($s,'_');
        };

        $findHeaderIndex = function(array $rows) use ($normalize) {
            foreach ($rows as $idx => $r) {
                $cols = array_map($normalize, $r);
                if (in_array('entry_date', $cols) && in_array('account_code', $cols)) return $idx; // generic
                if (in_array('date', $cols) && (in_array('gross_amount',$cols) || in_array('invoice_number',$cols))) return $idx; // sales
            }
            return 0; // fallback to first
        };

        $headerIdx = $findHeaderIndex($allRows);
        $header = $allRows[$headerIdx] ?? [];
        $cols = array_map($normalize, $header);
        $dataRows = array_slice($allRows, $headerIdx + 1);

        $isSales = in_array('date', $cols) && (in_array('gross_amount', $cols) || in_array('invoice_number', $cols));

        if (!$isSales) {
            // Generic journal import (entry_date, reference, account_code, debit, credit, description)
            $entries = [];
            foreach ($dataRows as $row) {
                $assoc = array_combine($cols, array_pad($row, count($cols), null));
                if (!$assoc) continue;
                $key = ($assoc['entry_date'] ?? '') . '|' . ($assoc['reference'] ?? '');
                $entries[$key][] = $assoc;
            }

            $created = 0; $errors = [];
            DB::beginTransaction();
            try {
                foreach ($entries as $key => $lines) {
                    $first = $lines[0];
                    $entry = JournalEntry::create([
                        'organization_id' => $org->id,
                        'entry_date' => $first['entry_date'],
                        'reference' => $first['reference'] ?? null,
                        'currency' => 'USD',
                        'exchange_rate' => 1,
                        'source' => 'manual',
                        'description' => $first['description'] ?? null,
                        'is_posted' => true,
                        'meta' => ['format' => 'generic', 'group_key' => $key],
                    ]);
                    $ln = 1; $totalDebit = 0; $totalCredit = 0;
                    foreach ($lines as $row) {
                        $acc = Account::where('organization_id',$org->id)->where('code',$row['account_code'])->first();
                        if (!$acc) throw new \RuntimeException('Account not found: '.$row['account_code']);
                        $debit = (float)($row['debit'] ?? 0);
                        $credit = (float)($row['credit'] ?? 0);
                        $totalDebit += $debit; $totalCredit += $credit;
                        JournalLine::create([
                            'journal_entry_id' => $entry->id,
                            'organization_id' => $org->id,
                            'account_id' => $acc->id,
                            'debit' => $debit,
                            'credit' => $credit,
                            'description' => $row['description'] ?? null,
                            'line_no' => $ln++,
                            'meta' => ['row' => $row],
                        ]);
                    }
                    if (round($totalDebit,2) !== round($totalCredit,2)) {
                        throw new \RuntimeException('Entry not balanced: '.$key);
                    }
                    $created++;
                }
                DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();
                $errors[] = $e->getMessage();
            }
            return response()->json(['entries_created' => $created, 'errors' => $errors, 'format' => 'generic']);
        }

        // Sales CSV import requires account code mapping via request
        $reqCode = function(string $field) use ($request) {
            $code = (string)$request->input($field, '');
            if ($code === '') throw new \InvalidArgumentException("Missing required account mapping: $field");
            return $code;
        };
        try {
            // Pull mappings from organization settings
            $salesMap = (array)($org->settings['imports']['sales'] ?? []);
            $arCode = (string)($salesMap['ar_account_code'] ?? '');
            $vatCode = (string)($salesMap['vat_payable_account_code'] ?? '');
            $salesGoods = (string)($salesMap['sales_goods_account_code'] ?? '');
            $salesServices = (string)($salesMap['sales_services_account_code'] ?? '');
            $salesExempt = (string)($salesMap['sales_exempt_account_code'] ?? '');
            $discountCode = (string)($salesMap['sales_discount_account_code'] ?? '');
            if ($arCode === '' || $vatCode === '') {
                throw new \InvalidArgumentException('Missing required sales mappings in organization settings');
            }

            $findAcc = function(string $code) use ($org) {
                $acc = Account::where('organization_id',$org->id)->where('code',$code)->first();
                if (!$acc) throw new \RuntimeException('Account not found: '.$code);
                return $acc;
            };
            // Base accounts from settings (row-level overrides may replace below)
            $accSettings = [
                'ar' => $findAcc($arCode),
                'vat' => $findAcc($vatCode),
                'sales_goods' => $salesGoods ? $findAcc($salesGoods) : null,
                'sales_services' => $salesServices ? $findAcc($salesServices) : null,
                'sales_exempt' => $salesExempt ? $findAcc($salesExempt) : null,
                'discount' => $discountCode ? $findAcc($discountCode) : null,
            ];

            $created = 0; $errors = [];
            DB::beginTransaction();
            $lnGlobal = 1;
            foreach ($dataRows as $row) {
                $assoc = array_combine($cols, array_pad($row, count($cols), null));
                if (!$assoc) continue;
                // Row-level overrides (optional columns)
                $normAssoc = [];
                foreach ($assoc as $k=>$v) { $normAssoc[$normalize($k)] = $v; }
                $rowCode = function(array $keys) use ($normAssoc) {
                    foreach ($keys as $k) {
                        if (isset($normAssoc[$k]) && trim((string)$normAssoc[$k]) !== '') return trim((string)$normAssoc[$k]);
                    }
                    return null;
                };
                // Parse date
                $dateStr = (string)($assoc['date'] ?? $assoc['entry_date'] ?? '');
                $entryDate = $dateStr;
                try {
                    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr)) {
                        $entryDate = $dateStr;
                    } else {
                        $dt = \Carbon\Carbon::createFromFormat('d-M-y', $dateStr);
                        if ($dt) $entryDate = $dt->toDateString();
                    }
                } catch (\Throwable $e) {}

                $inv = (string)($assoc['invoice_number'] ?? '');
                $client = (string)($assoc['client'] ?? '');
                $tin = (string)($assoc['tin_no'] ?? $assoc['tin_no_'] ?? '');
                $addr = (string)($assoc['address'] ?? '');
                $desc = (string)($assoc['description'] ?? '');
                $gross = (float)str_replace([','],[''], (string)($assoc['gross_amount'] ?? 0));
                $vat = (float)str_replace([','],[''], (string)($assoc['output_tax'] ?? 0));
                $net = (float)str_replace([','],[''], (string)($assoc['net_of_vat'] ?? 0));
                $exempt1 = (float)str_replace([','],[''], (string)($assoc['vat_exempt_sc_pwd'] ?? 0));
                $exempt2 = (float)str_replace([','],[''], (string)($assoc['vat_exempt_others'] ?? 0));
                $disc = (float)str_replace([','],[''], (string)($assoc['discount'] ?? 0));

                $entry = JournalEntry::create([
                    'organization_id' => $org->id,
                    'entry_date' => $entryDate ?: now()->toDateString(),
                    'reference' => $inv ? ('INV '.$inv) : null,
                    'currency' => 'USD',
                    'exchange_rate' => 1,
                    'source' => 'sales',
                    'description' => trim("$client | TIN: $tin | $addr"),
                    'is_posted' => true,
                    'meta' => ['format' => 'sales', 'row' => $assoc],
                ]);

                $ln = 1; $totalD = 0; $totalC = 0;

                // Determine accounts (row overrides first)
                $accAR = $findAcc($rowCode(['ar_account_code','ar','ar_code']) ?? $accSettings['ar']->code);
                $accVAT = $findAcc($rowCode(['vat_payable_account_code','vat','vat_code','output_vat_account_code']) ?? $accSettings['vat']->code);
                $accSalesGoods = null; $accSalesServices = null; $accSalesExempt = null; $accDiscount = null;
                $rg = $rowCode(['sales_goods_account_code','sales_goods','goods_account_code']);
                $rs = $rowCode(['sales_services_account_code','sales_services','services_account_code']);
                $re = $rowCode(['sales_exempt_account_code','sales_exempt']);
                $rd = $rowCode(['sales_discount_account_code','sales_discount']);
                $accSalesGoods = $rg ? $findAcc($rg) : ($accSettings['sales_goods'] ?? null);
                $accSalesServices = $rs ? $findAcc($rs) : ($accSettings['sales_services'] ?? null);
                $accSalesExempt = $re ? $findAcc($re) : ($accSettings['sales_exempt'] ?? null);
                $accDiscount = $rd ? $findAcc($rd) : ($accSettings['discount'] ?? null);

                // Debit AR (gross - discount)
                $arAmt = round((float)($gross - $disc), 2);
                JournalLine::create([
                    'journal_entry_id' => $entry->id,
                    'organization_id' => $org->id,
                    'account_id' => $accAR->id,
                    'debit' => $arAmt,
                    'credit' => 0,
                    'description' => 'Accounts Receivable',
                    'line_no' => $ln++,
                    'meta' => ['computed_from' => ['gross'=>$gross, 'discount'=>$disc]],
                ]); $totalD += $arAmt;

                // Credit VAT Output
                if ($vat > 0) {
                    JournalLine::create([
                        'journal_entry_id' => $entry->id,
                        'organization_id' => $org->id,
                        'account_id' => $accVAT->id,
                        'debit' => 0,
                        'credit' => round($vat,2),
                        'description' => 'Output VAT',
                        'line_no' => $ln++,
                        'meta' => ['source' => 'output_tax'],
                    ]); $totalC += round($vat,2);
                }

                // Credit Sales (net)
                $salesAcc = null;
                if ($desc && stripos($desc, 'goods') !== false) $salesAcc = $accSalesGoods;
                if (!$salesAcc && $desc && stripos($desc, 'services') !== false) $salesAcc = $accSalesServices;
                if (!$salesAcc) $salesAcc = $accSalesGoods ?: $accSalesServices; // fallback
                if ($salesAcc && $net > 0) {
                    JournalLine::create([
                        'journal_entry_id' => $entry->id,
                        'organization_id' => $org->id,
                        'account_id' => $salesAcc->id,
                        'debit' => 0,
                        'credit' => round($net,2),
                        'description' => $desc ?: 'Sales',
                        'line_no' => $ln++,
                        'meta' => ['source' => 'net_of_vat'],
                    ]); $totalC += round($net,2);
                }

                // Credit Sales Exempt (if any)
                $exempt = round($exempt1 + $exempt2, 2);
                if ($accSalesExempt && $exempt > 0) {
                    JournalLine::create([
                        'journal_entry_id' => $entry->id,
                        'organization_id' => $org->id,
                        'account_id' => $accSalesExempt->id,
                        'debit' => 0,
                        'credit' => $exempt,
                        'description' => 'Sales - VAT Exempt',
                        'line_no' => $ln++,
                        'meta' => ['source' => 'exempt_total'],
                    ]); $totalC += $exempt;
                }

                // Debit Discount (if any)
                if ($accDiscount && $disc > 0) {
                    JournalLine::create([
                        'journal_entry_id' => $entry->id,
                        'organization_id' => $org->id,
                        'account_id' => $accDiscount->id,
                        'debit' => round($disc,2),
                        'credit' => 0,
                        'description' => 'Sales Discount',
                        'line_no' => $ln++,
                        'meta' => ['source' => 'discount'],
                    ]); $totalD += round($disc,2);
                }

                if (round($totalD,2) !== round($totalC,2)) {
                    throw new \RuntimeException('Generated entry not balanced for invoice '.$inv.' (D='.$totalD.' C='.$totalC.')');
                }
                $created++;
            }
            DB::commit();
            return response()->json(['entries_created' => $created, 'errors' => [], 'format' => 'sales']);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['entries_created' => 0, 'errors' => [$e->getMessage()], 'format' => 'sales'], 422);
        }
    }

    public function importPurchases(Request $request)
    {
        $org = $request->attributes->get('organization');
        $request->validate(['file' => 'required|file|mimes:csv,txt']);
        $path = $request->file('file')->getRealPath();
        $handle = fopen($path, 'r');
        if (!$handle) return response()->json(['message' => 'Unable to read file'], 400);

        $rows = [];
        while (($row = fgetcsv($handle)) !== false) { $rows[] = $row; }
        fclose($handle);

        $normalize = function(string $s) {
            $s = strtolower(trim($s));
            $s = preg_replace('/[^a-z0-9]+/','_', $s);
            return trim($s,'_');
        };
        $findHeaderIndex = function(array $rows) use ($normalize) {
            foreach ($rows as $idx => $r) {
                $cols = array_map($normalize, $r);
                if (in_array('invoice_number',$cols) && in_array('gross_amount',$cols)) return $idx;
            }
            return 0;
        };
        $hidx = $findHeaderIndex($rows);
        $header = $rows[$hidx] ?? [];
        $cols = array_map($normalize, $header);
        $dataRows = array_slice($rows, $hidx+1);

        // Required mappings
        $getCode = function(string $key, bool $required = true) use ($request) {
            $val = (string)$request->input($key, '');
            if ($required && $val === '') throw new \InvalidArgumentException("Missing required mapping: $key");
            return $val;
        };
        try {
                $pmap = (array)($org->settings['imports']['purchases'] ?? []);
                $creditDefault = (string)($pmap['credit_account_code'] ?? '');
                $cashCode = (string)($pmap['cash_account_code'] ?? '');
                $inputVatCode = (string)($pmap['input_vat_account_code'] ?? '');
                $expVatable = (string)($pmap['expense_vatable_account_code'] ?? '');
                $expNonVat = (string)($pmap['expense_non_vat_account_code'] ?? '');
                $expDefault = (string)($pmap['default_expense_account_code'] ?? '');
            if ($creditDefault === '' || $inputVatCode === '') {
                throw new \InvalidArgumentException('Missing required purchases mappings in organization settings');
            }
            if ($expVatable === '' && $expDefault === '') throw new \InvalidArgumentException('Provide expense_vatable_account_code or default_expense_account_code');
            if ($expNonVat === '' && $expDefault === '') throw new \InvalidArgumentException('Provide expense_non_vat_account_code or default_expense_account_code');

            $findAcc = function(string $code) use ($org) {
                $acc = Account::where('organization_id',$org->id)->where('code',$code)->first();
                if (!$acc) throw new \RuntimeException('Account not found: '.$code);
                return $acc;
            };
            $accCreditDefault = $findAcc($creditDefault);
            $accCash = $cashCode ? $findAcc($cashCode) : null;
            $accInputVAT = $findAcc($inputVatCode);
            $accExpVatable = $expVatable ? $findAcc($expVatable) : ($expDefault ? $findAcc($expDefault) : null);
            $accExpNonVat = $expNonVat ? $findAcc($expNonVat) : ($expDefault ? $findAcc($expDefault) : null);

            $created = 0; $errors = [];
            DB::beginTransaction();
            foreach ($dataRows as $row) {
                $data = array_combine($cols, array_pad($row, count($cols), null));
                if (!$data) continue;
                $normRow = [];
                foreach ($data as $k=>$v) { $normRow[$normalize($k)] = $v; }
                $rget = function(array $keys) use ($normRow) {
                    foreach ($keys as $k) { if (isset($normRow[$k]) && trim((string)$normRow[$k]) !== '') return trim((string)$normRow[$k]); }
                    return null;
                };
                $dateStr = (string)($data['date'] ?? '');
                $entryDate = $dateStr ?: now()->toDateString();
                try {
                    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr)) {
                        $dt = \Carbon\Carbon::createFromFormat('d-M-y', $dateStr);
                        if ($dt) $entryDate = $dt->toDateString();
                    }
                } catch (\Throwable $e) {}
                $supplier = (string)($data['supplier'] ?? '');
                $tin = (string)($data['tin_no'] ?? $data['tin_no_'] ?? '');
                $addr = (string)($data['address'] ?? '');
                $inv = (string)($data['invoice_number'] ?? '');
                $gross = (float)str_replace([','],[''], (string)($data['gross_amount'] ?? 0));
                $vatIn = (float)str_replace([','],[''], (string)($data['input_tax'] ?? 0));
                $net = (float)str_replace([','],[''], (string)($data['net_of_vat'] ?? 0));
                $nonVat = (float)str_replace([','],[''], (string)($data['non_vat'] ?? 0));
                $acctTitle = strtolower((string)($data['account_title'] ?? ''));

                $sign = $gross >= 0 ? 1 : -1; $gross = abs($gross); $vatIn = abs($vatIn); $net = abs($net); $nonVat = abs($nonVat);
                // Row-level overrides
                $creditCodeOverride = $rget(['credit_account_code','ap_account_code','credit_code']);
                $cashCodeOverride = $rget(['cash_account_code','cash_code']);
                $inputVatOverride = $rget(['input_vat_account_code','input_tax_account_code']);
                $expVatOverride = $rget(['expense_vatable_account_code','expense_vat_account_code']);
                $expNonVatOverride = $rget(['expense_non_vat_account_code']);
                $defaultExpOverride = $rget(['default_expense_account_code']);

                $accCreditDefaultRow = $creditCodeOverride ? $findAcc($creditCodeOverride) : $accCreditDefault;
                $accCashRow = $cashCodeOverride ? $findAcc($cashCodeOverride) : $accCash;
                $accInputVATRow = $inputVatOverride ? $findAcc($inputVatOverride) : $accInputVAT;
                $accExpVatableRow = $expVatOverride ? $findAcc($expVatOverride) : $accExpVatable;
                $accExpNonVatRow = $expNonVatOverride ? $findAcc($expNonVatOverride) : $accExpNonVat;
                if (!$accExpVatableRow && $defaultExpOverride) $accExpVatableRow = $findAcc($defaultExpOverride);
                if (!$accExpNonVatRow && $defaultExpOverride) $accExpNonVatRow = $findAcc($defaultExpOverride);

                $creditAcc = ($accCashRow && str_contains($acctTitle, 'cash')) ? $accCashRow : $accCreditDefaultRow;

                $entry = JournalEntry::create([
                    'organization_id' => $org->id,
                    'entry_date' => $entryDate,
                    'reference' => $inv ? ('BILL '.$inv) : null,
                    'currency' => 'USD',
                    'exchange_rate' => 1,
                    'source' => 'purchase',
                    'description' => trim("$supplier | TIN: $tin | $addr"),
                    'is_posted' => true,
                    'meta' => ['format' => 'purchase', 'row' => $data],
                ]);

                $ln = 1; $totalD = 0; $totalC = 0;

                $post = function($acc, $debit, $credit, $desc, $meta = []) use (&$ln, $entry, $org, &$totalD, &$totalC) {
                    if (round($debit,2) == 0 && round($credit,2) == 0) return;
                    JournalLine::create([
                        'journal_entry_id' => $entry->id,
                        'organization_id' => $org->id,
                        'account_id' => $acc->id,
                        'debit' => round($debit,2),
                        'credit' => round($credit,2),
                        'description' => $desc,
                        'line_no' => $ln++,
                        'meta' => $meta,
                    ]);
                    $totalD += round($debit,2); $totalC += round($credit,2);
                };

                if ($sign > 0) {
                    $post($accExpVatableRow, $net, 0, 'Expense (VATable)', ['source'=>'net_of_vat']);
                    $post($accExpNonVatRow, $nonVat, 0, 'Expense (Non-VAT)', ['source'=>'non_vat']);
                    $post($accInputVATRow, $vatIn, 0, 'Input VAT', ['source'=>'input_tax']);
                    $post($creditAcc, 0, $gross, 'Payable/Payment', ['source'=>'gross_amount']);
                } else {
                    // Return/credit note
                    $post($accExpVatableRow, 0, $net, 'Expense Reversal (VATable)', ['source'=>'net_of_vat']);
                    $post($accExpNonVatRow, 0, $nonVat, 'Expense Reversal (Non-VAT)', ['source'=>'non_vat']);
                    $post($accInputVATRow, 0, $vatIn, 'Input VAT Reversal', ['source'=>'input_tax']);
                    $post($creditAcc, $gross, 0, 'Refund/Offset', ['source'=>'gross_amount']);
                }

                if (round($totalD,2) !== round($totalC,2)) {
                    throw new \RuntimeException('Generated entry not balanced for bill '.$inv.' (D='.$totalD.' C='.$totalC.')');
                }
                $created++;
            }
            DB::commit();
            return response()->json(['entries_created' => $created, 'errors' => []]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['entries_created' => 0, 'errors' => [$e->getMessage()]], 422);
        }
    }
}
