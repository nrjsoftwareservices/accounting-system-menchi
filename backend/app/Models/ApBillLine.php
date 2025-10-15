<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel as Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApBillLine extends Model
{
    use HasFactory;
    protected $table = 'ap_bill_lines';
    protected $fillable = ['ap_bill_id','account_id','description','qty','unit_price','amount','line_no'];
    protected $casts = ['qty' => 'decimal:4'];
    public function bill(): BelongsTo { return $this->belongsTo(ApBill::class, 'ap_bill_id'); }
    public function account(): BelongsTo { return $this->belongsTo(Account::class); }
}
