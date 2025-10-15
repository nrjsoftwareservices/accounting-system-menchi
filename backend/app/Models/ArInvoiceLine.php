<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel as Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArInvoiceLine extends Model
{
    use HasFactory;
    protected $table = 'ar_invoice_lines';
    protected $fillable = ['ar_invoice_id','account_id','description','qty','unit_price','amount','line_no'];
    protected $casts = ['qty' => 'decimal:4'];
    public function invoice(): BelongsTo { return $this->belongsTo(ArInvoice::class, 'ar_invoice_id'); }
    public function account(): BelongsTo { return $this->belongsTo(Account::class); }
}
