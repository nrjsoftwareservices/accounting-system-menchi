<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel as Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApBill extends Model
{
    use HasFactory;
    protected $table = 'ap_bills';
    protected $fillable = [
        'organization_id','supplier_id','bill_no','bill_date','due_date','currency','exchange_rate','status','subtotal','tax_total','total'
    ];
    protected $casts = [
        'bill_date' => 'date',
        'due_date' => 'date',
        'exchange_rate' => 'decimal:8'
    ];
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function lines(): HasMany { return $this->hasMany(ApBillLine::class); }
}
