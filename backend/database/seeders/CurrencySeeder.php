<?php

namespace Database\Seeders;

use App\Models\Currency;
use Illuminate\Support\Arr;
use Illuminate\Database\Seeder;

class CurrencySeeder extends Seeder
{
    public function run(): void
    {
        $currencies = [
            ['code' => 'USD', 'name' => 'US Dollar', 'symbol' => '$', 'decimal_places' => 2],
            ['code' => 'EUR', 'name' => 'Euro', 'symbol' => '€', 'decimal_places' => 2],
            ['code' => 'PHP', 'name' => 'Philippine Peso', 'symbol' => '₱', 'decimal_places' => 2],
        ];
        foreach ($currencies as $c) {
            // Avoid attempting to update the primary key 'code'
            Currency::updateOrCreate(['code' => $c['code']], Arr::except($c, ['code']));
        }
    }
}
