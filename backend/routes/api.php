<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\AccountController;
use App\Http\Controllers\JournalEntryController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\TaxController;
use App\Http\Controllers\DashboardController;

Route::prefix('v1')->group(function () {
    // Registration is disabled; only admins can create users via admin endpoints
    // Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        // Organizations (listing does not require org context)
        Route::get('/organizations', [OrganizationController::class, 'index']);
        // Creating an organization now checks admin role across any org inside the controller
        Route::post('/organizations', [OrganizationController::class, 'store']);
        Route::put('/organizations/{id}', [OrganizationController::class, 'update']);
        Route::delete('/organizations/{id}', [OrganizationController::class, 'destroy']);
        Route::get('/organizations/{id}/members', [OrganizationController::class, 'membersIndex']);
        Route::post('/organizations/{id}/members', [OrganizationController::class, 'membersStore']);
        Route::put('/organizations/{id}/members/{userId}', [OrganizationController::class, 'membersUpdate']);
        Route::delete('/organizations/{id}/members/{userId}', [OrganizationController::class, 'membersDestroy']);

        // Accounts: read clerk+, write accountant+
        Route::get('/accounts', [AccountController::class, 'index'])->middleware('org.role:clerk');
        Route::post('/accounts', [AccountController::class, 'store'])->middleware('org.role:accountant');
        Route::put('/accounts/{id}', [AccountController::class, 'update'])->middleware('org.role:accountant');
        Route::delete('/accounts/{id}', [AccountController::class, 'destroy'])->middleware('org.role:accountant');
        Route::get('/accounts/check-code', [AccountController::class, 'checkCode'])->middleware('org.role:accountant');

        // Journals: read manager+, write accountant+
        Route::get('/journals', [JournalEntryController::class, 'index'])->middleware('org.role:manager');
        Route::post('/journals', [JournalEntryController::class, 'store'])->middleware('org.role:accountant');
        Route::put('/journals/{id}', [JournalEntryController::class, 'update'])->middleware('org.role:accountant');

        // AR/AP modules are hidden; comment routes out to disable endpoints
        // Route::get('/ar/invoices', [...]);
        // Route::post('/ar/invoices', [...]);
        // Route::put('/ar/invoices/{id}', [...]);
        // Route::delete('/ar/invoices/{id}', [...]);
        // Route::post('/ar/invoices/{id}/post', [...]);

        // Route::get('/ap/bills', [...]);
        // Route::post('/ap/bills', [...]);
        // Route::put('/ap/bills/{id}', [...]);
        // Route::delete('/ap/bills/{id}', [...]);
        // Route::post('/ap/bills/{id}/post', [...]);

        // Reports: manager+
        Route::get('/reports/trial-balance', [ReportController::class, 'trialBalance'])->middleware('org.role:manager');

        // Tax: Percentage Tax (manager+)
        Route::get('/tax/percentage', [TaxController::class, 'getPercentage'])->middleware('org.role:manager');
        Route::put('/tax/percentage', [TaxController::class, 'savePercentage'])->middleware('org.role:manager');

        // Imports: accounts/journals accountant+
        Route::post('/imports/accounts', [\App\Http\Controllers\ImportController::class, 'importAccounts'])->middleware('org.role:accountant');
        Route::post('/imports/journals', [\App\Http\Controllers\ImportController::class, 'importJournals'])->middleware('org.role:accountant');
        Route::post('/imports/purchases', [\App\Http\Controllers\ImportController::class, 'importPurchases'])->middleware('org.role:accountant');

        // Staff management (firm-only): admin on any selected client context
        Route::get('/admin/users', [\App\Http\Controllers\StaffController::class, 'index'])->middleware('org.role:admin');
        Route::post('/admin/users', [\App\Http\Controllers\StaffController::class, 'store'])->middleware('org.role:admin');

        // Master data modules for Customers/Suppliers are disabled (data comes from CSV imports).
        // If you need them later, re-enable the routes below.
        // Route::get('/customers', [\App\Http\Controllers\CustomerController::class, 'index'])->middleware('org.role:clerk');
        // Route::post('/customers', [\App\Http\Controllers\CustomerController::class, 'store'])->middleware('org.role:accountant');
        // Route::put('/customers/{id}', [\App\Http\Controllers\CustomerController::class, 'update'])->middleware('org.role:accountant');
        // Route::delete('/customers/{id}', [\App\Http\Controllers\CustomerController::class, 'destroy'])->middleware('org.role:accountant');

        // Route::get('/suppliers', [\App\Http\Controllers\SupplierController::class, 'index'])->middleware('org.role:clerk');
        // Route::post('/suppliers', [\App\Http\Controllers\SupplierController::class, 'store'])->middleware('org.role:accountant');
        // Route::put('/suppliers/{id}', [\App\Http\Controllers\SupplierController::class, 'update'])->middleware('org.role:accountant');
        // Route::delete('/suppliers/{id}', [\App\Http\Controllers\SupplierController::class, 'destroy'])->middleware('org.role:accountant');

        // CSV Exports (streamed)
        Route::get('/exports/accounts', [ExportController::class, 'accounts'])->middleware('org.role:clerk');
        Route::get('/exports/customers', [ExportController::class, 'customers'])->middleware('org.role:clerk');
        Route::get('/exports/suppliers', [ExportController::class, 'suppliers'])->middleware('org.role:clerk');
        // Route::get('/exports/ar/invoices', [ExportController::class, 'arInvoices'])->middleware('org.role:manager');
        // Route::get('/exports/ap/bills', [ExportController::class, 'apBills'])->middleware('org.role:manager');
        Route::get('/exports/reports/trial-balance', [ExportController::class, 'trialBalance'])->middleware('org.role:manager');
        Route::get('/exports/journals', [ExportController::class, 'journals'])->middleware('org.role:accountant');
        // Route::get('/exports/ar/ledger', [ExportController::class, 'arLedger'])->middleware('org.role:manager');
        // Route::get('/exports/ap/ledger', [ExportController::class, 'apLedger'])->middleware('org.role:manager');

        // Contacts from journal meta
        Route::get('/reports/contacts', [ReportController::class, 'contacts'])->middleware('org.role:manager');
        Route::get('/exports/contacts/customers', [ExportController::class, 'contactsCustomers'])->middleware('org.role:manager');
        Route::get('/exports/contacts/suppliers', [ExportController::class, 'contactsSuppliers'])->middleware('org.role:manager');

        // Dashboard overview
        Route::get('/dashboard/summary', [DashboardController::class, 'summary'])->middleware('org.role:auditor');
    });
});
