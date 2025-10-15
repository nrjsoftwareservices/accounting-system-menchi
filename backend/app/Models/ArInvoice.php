<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel as Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ArInvoice extends Model
{
    use HasFactory;
    protected $table = 'ar_invoices';
    protected $fillable = [
        'organization_id','customer_id','invoice_no','invoice_date','due_date','currency','exchange_rate','status','subtotal','tax_total','total'
    ];
    protected $casts = [
        'invoice_date' => 'date',
        'due_date' => 'date',
        'exchange_rate' => 'decimal:8'
    ];
    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function lines(): HasMany { return $this->hasMany(ArInvoiceLine::class); }
}
