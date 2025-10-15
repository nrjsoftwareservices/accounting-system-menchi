<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApBillPostRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }
    public function rules(): array
    {
        return [
            'ap_account_id' => 'required|exists:accounts,id',
        ];
    }
}

