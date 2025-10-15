<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ap_bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->string('bill_no');
            $table->date('bill_date');
            $table->date('due_date')->nullable();
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 18, 8)->default(1);
            $table->enum('status', ['draft','posted','paid','void'])->default('draft');
            $table->decimal('subtotal', 18, 2)->default(0);
            $table->decimal('tax_total', 18, 2)->default(0);
            $table->decimal('total', 18, 2)->default(0);
            $table->timestamps();
            $table->unique(['organization_id','bill_no']);
        });

        Schema::create('ap_bill_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ap_bill_id')->constrained('ap_bills')->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete(); // expense account
            $table->string('description');
            $table->decimal('qty', 18, 4)->default(1);
            $table->decimal('unit_price', 18, 2)->default(0);
            $table->decimal('amount', 18, 2)->default(0);
            $table->unsignedInteger('line_no');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ap_bill_lines');
        Schema::dropIfExists('ap_bills');
    }
};

