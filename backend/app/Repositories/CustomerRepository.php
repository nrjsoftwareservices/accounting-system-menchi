<?php

namespace App\Repositories;

use App\Models\Customer;

class CustomerRepository
{
    public function paginate(int $orgId, int $perPage, string $sort, string $dir, ?string $search = null)
    {
        $q = Customer::where('organization_id', $orgId);
        if ($search) {
            $q->where(function ($w) use ($search) {
                $w->where('name','like',"%$search%")
                    ->orWhere('code','like',"%$search%")
                    ->orWhere('email','like',"%$search%");
            });
        }
        return $q->orderBy($sort, $dir)->paginate($perPage);
    }

    public function create(int $orgId, array $data): Customer
    {
        $data['organization_id'] = $orgId;
        return Customer::create($data);
    }

    public function update(Customer $c, array $data): Customer
    {
        $c->update($data);
        return $c;
    }

    public function delete(Customer $c): void
    {
        $c->delete();
    }

    public function isReferenced(int $orgId, int $customerId): bool
    {
        return \DB::table('ar_invoices')->where('organization_id',$orgId)->where('customer_id',$customerId)->exists();
    }
}

