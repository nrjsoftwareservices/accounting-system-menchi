<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OrganizationStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null; // auth handled by route middleware
    }

    public function rules(): array
    {
        return [
            'name' => ['required','string'],
            'code' => ['required','string','unique:organizations,code'],
            'default_currency' => ['nullable','string','size:3'],
        ];
    }
}

