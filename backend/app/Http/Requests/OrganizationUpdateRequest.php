<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OrganizationUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null; // finer auth in controller
    }

    public function rules(): array
    {
        $id = (int) $this->route('id');
        return [
            'name' => ['required','string'],
            'code' => ['required','string','unique:organizations,code,'.$id],
            'default_currency' => ['nullable','string','size:3'],
            'settings' => ['sometimes','array'],
            'settings.imports' => ['sometimes','array'],
            'settings.imports.sales' => ['sometimes','array'],
            'settings.imports.sales.ar_account_code' => ['sometimes','string'],
            'settings.imports.sales.vat_payable_account_code' => ['sometimes','string'],
            'settings.imports.sales.sales_goods_account_code' => ['sometimes','string'],
            'settings.imports.sales.sales_services_account_code' => ['sometimes','string'],
            'settings.imports.sales.sales_exempt_account_code' => ['sometimes','string'],
            'settings.imports.sales.sales_discount_account_code' => ['sometimes','string'],
            'settings.imports.purchases' => ['sometimes','array'],
            'settings.imports.purchases.credit_account_code' => ['sometimes','string'],
            'settings.imports.purchases.cash_account_code' => ['sometimes','string'],
            'settings.imports.purchases.input_vat_account_code' => ['sometimes','string'],
            'settings.imports.purchases.expense_vatable_account_code' => ['sometimes','string'],
            'settings.imports.purchases.expense_non_vat_account_code' => ['sometimes','string'],
            'settings.imports.purchases.default_expense_account_code' => ['sometimes','string'],
        ];
    }
}
