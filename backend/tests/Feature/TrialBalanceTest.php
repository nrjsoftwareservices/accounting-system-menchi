<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TrialBalanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_trial_balance_balances_debits_and_credits(): void
    {
        $this->seed();
        $org = Organization::create(['uuid' => (string) Str::uuid(), 'name' => 'Org', 'code' => 'ORG', 'default_currency' => 'USD']);
        $user = User::factory()->create();
        \DB::table('user_organizations')->insert([
            'user_id' => $user->id,
            'organization_id' => $org->id,
            'role' => 'manager',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $cash = Account::create(['organization_id'=>$org->id,'code'=>'1000','name'=>'Cash','type'=>'asset']);
        $revenue = Account::create(['organization_id'=>$org->id,'code'=>'4000','name'=>'Revenue','type'=>'revenue']);

        $entry = JournalEntry::create([
            'organization_id'=>$org->id,
            'entry_date'=>now()->toDateString(),
            'currency'=>'USD','exchange_rate'=>1,'source'=>'manual','is_posted'=>true
        ]);
        JournalLine::create(['journal_entry_id'=>$entry->id,'organization_id'=>$org->id,'account_id'=>$cash->id,'debit'=>100,'credit'=>0,'line_no'=>1]);
        JournalLine::create(['journal_entry_id'=>$entry->id,'organization_id'=>$org->id,'account_id'=>$revenue->id,'debit'=>0,'credit'=>100,'line_no'=>2]);

        $resp = $this->actingAs($user)->getJson('/api/v1/reports/trial-balance?organization_id='.$org->id);
        $resp->assertOk();
        $resp->assertJsonPath('totals.total_debit', 100);
        $resp->assertJsonPath('totals.total_credit', 100);
    }
}
