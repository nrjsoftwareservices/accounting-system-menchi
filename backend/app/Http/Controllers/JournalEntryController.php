<?php

namespace App\Http\Controllers;

use App\Models\JournalEntry;
use Illuminate\Http\Request;
use App\Http\Requests\JournalStoreRequest;

class JournalEntryController extends Controller
{
    public function __construct(private \App\Repositories\JournalRepository $repo) {}

    public function index(Request $request)
    {
        $org = $request->attributes->get('organization');
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        return response()->json($this->repo->paginate($org->id, $perPage));
    }

    public function store(JournalStoreRequest $request)
    {
        $org = $request->attributes->get('organization');
        $entry = $this->repo->createPosted($org?->id ?? $request->integer('organization_id'), $request->validated());
        return response()->json($entry, 201);
    }

    public function update(JournalStoreRequest $request, int $id)
    {
        $org = $request->attributes->get('organization');
        $entry = JournalEntry::where('organization_id', $org->id)->findOrFail($id);
        $updated = $this->repo->updateEntry($entry, $request->validated());
        return response()->json($updated);
    }
}
