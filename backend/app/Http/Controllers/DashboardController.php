<?php

namespace App\Http\Controllers;

use App\Models\ApBill;
use App\Models\ArInvoice;
use App\Models\JournalEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private array $roleHierarchy = [
        'auditor' => 1,
        'clerk' => 2,
        'manager' => 3,
        'accountant' => 4,
        'admin' => 5,
    ];

    private array $moduleRoleMap = [
        // Quick actions
        'add_client' => 'admin',
        'post_journal' => 'accountant',
        'create_invoice' => 'accountant',
        'create_bill' => 'accountant',
        'imports' => 'accountant',
        // Modules
        'organizations' => 'clerk',
        'accounts' => 'clerk',
        'customers' => 'clerk',
        'contacts' => 'manager',
        'ar_invoices' => 'manager',
        'suppliers' => 'clerk',
        'ap_bills' => 'manager',
        'tax' => 'manager',
        'journals' => 'manager',
        'trial_balance' => 'manager',
        't_accounts' => 'manager',
        'staff' => 'admin',
        'clients' => 'clerk',
    ];

    public function summary(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $org = $request->attributes->get('organization');
        $orgId = $org?->id ?? (int) $request->query('organization_id', 0);
        if (!$orgId) {
            return response()->json(['message' => 'Organization required'], 400);
        }

        $membership = DB::table('user_organizations')
            ->where('user_id', $user->id)
            ->where('organization_id', $orgId)
            ->first();

        if (!$membership) {
            return response()->json(['message' => 'Forbidden: not a member of organization'], 403);
        }

        $role = $membership->role ?: 'clerk';
        $roleRank = $this->roleHierarchy[$role] ?? 0;

        $now = Carbon::now();
        $weekAgo = $now->copy()->subDays(7);

        $totalClients = DB::table('user_organizations')
            ->where('user_id', $user->id)
            ->count();

        $newClients = DB::table('user_organizations')
            ->where('user_id', $user->id)
            ->where('created_at', '>=', $weekAgo)
            ->count();

        $openAr = ArInvoice::where('organization_id', $orgId)
            ->whereIn('status', ['draft', 'posted'])
            ->count();

        $recentAr = ArInvoice::where('organization_id', $orgId)
            ->where('created_at', '>=', $weekAgo)
            ->count();

        $openAp = ApBill::where('organization_id', $orgId)
            ->whereIn('status', ['draft', 'posted'])
            ->count();

        $recentAp = ApBill::where('organization_id', $orgId)
            ->where('created_at', '>=', $weekAgo)
            ->count();

        $unpostedJournals = JournalEntry::where('organization_id', $orgId)
            ->where('is_posted', false)
            ->count();

        $recentJournals = JournalEntry::where('organization_id', $orgId)
            ->where('created_at', '>=', $weekAgo)
            ->count();

        $activity = $this->buildActivityFeed($orgId);

        $permissions = [
            'role' => $role,
            'role_rank' => $roleRank,
            'modules' => collect($this->moduleRoleMap)
                ->mapWithKeys(function (string $requiredRole, string $module) use ($roleRank) {
                    $requiredRank = $this->roleHierarchy[$requiredRole] ?? PHP_INT_MAX;
                    return [$module => $roleRank >= $requiredRank];
                })
                ->all(),
        ];

        return response()->json([
            'stats' => [
                'active_clients' => [
                    'label' => 'Active Clients',
                    'count' => $totalClients,
                    'delta' => $newClients,
                ],
                'open_ar_invoices' => [
                    'label' => 'Open A/R Invoices',
                    'count' => $openAr,
                    'delta' => $recentAr,
                ],
                'open_ap_bills' => [
                    'label' => 'Open A/P Bills',
                    'count' => $openAp,
                    'delta' => $recentAp,
                ],
                'unposted_journals' => [
                    'label' => 'Unposted Journals',
                    'count' => $unpostedJournals,
                    'delta' => $recentJournals,
                ],
            ],
            'activity' => $activity,
            'permissions' => $permissions,
        ]);
    }

    private function buildActivityFeed(int $orgId): array
    {
        $collection = collect();

        $invoices = ArInvoice::where('organization_id', $orgId)
            ->latest('updated_at')
            ->take(5)
            ->get(['id', 'invoice_no', 'status', 'updated_at', 'total']);

        foreach ($invoices as $invoice) {
            $collection->push([
                'id' => 'invoice_'.$invoice->id,
                'type' => 'invoice',
                'title' => $invoice->invoice_no ?: 'AR Invoice #'.$invoice->id,
                'status' => $invoice->status,
                'message' => match ($invoice->status) {
                    'posted' => 'Invoice posted to ledger',
                    'paid' => 'Payment applied',
                    'void' => 'Invoice voided',
                    default => 'Draft awaiting review',
                },
                'occurred_at' => optional($invoice->updated_at)->toIso8601String(),
                'amount' => (float) $invoice->total,
            ]);
        }

        $bills = ApBill::where('organization_id', $orgId)
            ->latest('updated_at')
            ->take(5)
            ->get(['id', 'bill_no', 'status', 'updated_at', 'total']);

        foreach ($bills as $bill) {
            $collection->push([
                'id' => 'bill_'.$bill->id,
                'type' => 'bill',
                'title' => $bill->bill_no ?: 'AP Bill #'.$bill->id,
                'status' => $bill->status,
                'message' => match ($bill->status) {
                    'posted' => 'Bill posted to ledger',
                    'paid' => 'Bill paid',
                    'void' => 'Bill voided',
                    default => 'Draft awaiting review',
                },
                'occurred_at' => optional($bill->updated_at)->toIso8601String(),
                'amount' => (float) $bill->total,
            ]);
        }

        $journals = JournalEntry::where('organization_id', $orgId)
            ->latest('updated_at')
            ->take(5)
            ->get(['id', 'reference', 'is_posted', 'updated_at']);

        foreach ($journals as $journal) {
            $collection->push([
                'id' => 'journal_'.$journal->id,
                'type' => 'journal',
                'title' => $journal->reference ?: 'Journal '.$journal->id,
                'status' => $journal->is_posted ? 'posted' : 'draft',
                'message' => $journal->is_posted ? 'Journal posted to ledger' : 'Awaiting posting',
                'occurred_at' => optional($journal->updated_at)->toIso8601String(),
            ]);
        }

        return $collection
            ->filter(fn ($item) => !empty($item['occurred_at']))
            ->sortByDesc('occurred_at')
            ->take(8)
            ->values()
            ->all();
    }
}
