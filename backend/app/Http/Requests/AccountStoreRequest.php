<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AccountStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'organization_id' => ['nullable','integer','exists:organizations,id'],
            'code' => ['required','string'],
            'name' => ['required','string'],
            'type' => ['required','string','in:asset,liability,equity,revenue,expense,contra_asset,contra_liability,contra_equity,other'],
            'parent_id' => ['nullable','integer','exists:accounts,id'],
            'level' => ['nullable','integer','min:1'],
        ];
    }
}

