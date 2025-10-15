<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SupplierUpdateRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }
    public function rules(): array
    {
        return [
            'code' => ['nullable','string'],
            'name' => ['required','string'],
            'email' => ['nullable','email'],
            'phone' => ['nullable','string'],
            'address' => ['nullable','array'],
        ];
    }
}

