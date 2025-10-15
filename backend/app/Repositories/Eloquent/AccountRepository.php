<?php

namespace App\Repositories\Eloquent;

use App\Models\Account;

class AccountRepository
{
    public function paginate(int $orgId, int $perPage, string $sort, string $dir)
    {
        return Account::where('organization_id', $orgId)
            ->orderBy($sort, $dir)
            ->paginate($perPage);
    }

    public function all(int $orgId)
    {
        return Account::where('organization_id', $orgId)
            ->orderBy('code')->get();
    }

    public function create(array $data): Account
    {
        return Account::create($data);
    }

    public function update(Account $account, array $data): Account
    {
        $account->update($data);
        return $account;
    }

    public function delete(Account $account): void
    {
        $account->delete();
    }

    public function hasChildren(Account $account): bool
    {
        return Account::where('parent_id', $account->id)->exists();
    }

    public function isReferenced(Account $account): bool
    {
        return \DB::table('journal_lines')->where('account_id', $account->id)->exists()
            || \DB::table('ar_invoice_lines')->where('account_id', $account->id)->exists()
            || \DB::table('ap_bill_lines')->where('account_id', $account->id)->exists();
    }

    public function isCodeUnique(int $orgId, string $code, ?int $ignoreId = null): bool
    {
        $q = Account::where('organization_id', $orgId)->where('code', $code);
        if ($ignoreId) $q->where('id', '!=', $ignoreId);
        return !$q->exists();
    }
}
