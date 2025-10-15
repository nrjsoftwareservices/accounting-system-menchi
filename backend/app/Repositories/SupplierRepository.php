<?php

namespace App\Repositories;

use App\Models\Supplier;

class SupplierRepository
{
    public function paginate(int $orgId, int $perPage, string $sort, string $dir, ?string $search = null)
    {
        $q = Supplier::where('organization_id', $orgId);
        if ($search) {
            $q->where(function ($w) use ($search) {
                $w->where('name','like',"%$search%")
                    ->orWhere('code','like',"%$search%")
                    ->orWhere('email','like',"%$search%");
            });
        }
        return $q->orderBy($sort, $dir)->paginate($perPage);
    }

    public function create(int $orgId, array $data): Supplier
    {
        $data['organization_id'] = $orgId;
        return Supplier::create($data);
    }

    public function update(Supplier $s, array $data): Supplier
    {
        $s->update($data);
        return $s;
    }

    public function delete(Supplier $s): void
    {
        $s->delete();
    }

    public function isReferenced(int $orgId, int $supplierId): bool
    {
        return \DB::table('ap_bills')->where('organization_id',$orgId)->where('supplier_id',$supplierId)->exists();
    }
}

