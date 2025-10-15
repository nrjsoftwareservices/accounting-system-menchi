<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->string('base_currency', 3);
            $table->string('quote_currency', 3);
            $table->decimal('rate', 18, 8);
            $table->date('effective_date');
            $table->timestamps();

            $table->unique(['base_currency', 'quote_currency', 'effective_date'], 'exchange_rates_unique');
            $table->foreign('base_currency')->references('code')->on('currencies')->cascadeOnUpdate();
            $table->foreign('quote_currency')->references('code')->on('currencies')->cascadeOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exchange_rates');
    }
};

