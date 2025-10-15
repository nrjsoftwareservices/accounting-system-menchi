<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\BaseModel as Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Supplier extends Model
{
    use HasFactory;
    protected $fillable = ['organization_id','code','name','email','phone','address'];
    protected $casts = ['address' => 'array'];
    public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
}
