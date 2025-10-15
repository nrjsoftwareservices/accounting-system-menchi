<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetOrganization
{
    public function handle(Request $request, Closure $next): Response
    {
        $orgId = $request->header('X-Org-Id') ?? $request->query('org_id') ?? $request->query('organization_id');
        if ($orgId) {
            $org = Organization::find($orgId);
            if (!$org) {
                return response()->json(['message' => 'Invalid organization'], 400);
            }
            $request->attributes->set('organization', $org);
        }
        return $next($request);
    }
}
