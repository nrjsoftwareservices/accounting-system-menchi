<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model as EloquentModel;
use DateTimeInterface;

abstract class BaseModel extends EloquentModel
{
    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }
}

