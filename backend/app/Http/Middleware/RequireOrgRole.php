<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireOrgRole
{
    private array $hierarchy = [
        'auditor' => 1,
        'clerk' => 2,
        'manager' => 3,
        'accountant' => 4,
        'admin' => 5,
    ];

    public function handle(Request $request, Closure $next, string $minRole): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        /** @var Organization|null $org */
        $org = $request->attributes->get('organization');
        $orgId = $org?->id ?? (int) $request->query('organization_id', 0);
        if (!$orgId) {
            return response()->json(['message' => 'Organization required'], 400);
        }

        $rel = \DB::table('user_organizations')
            ->where('user_id', $user->id)
            ->where('organization_id', $orgId)
            ->first();

        if (!$rel) {
            return response()->json(['message' => 'Forbidden: not a member of organization'], 403);
        }

        $userRole = $rel->role ?: 'clerk';
        if (($this->hierarchy[$userRole] ?? 0) < ($this->hierarchy[$minRole] ?? 99)) {
            return response()->json(['message' => 'Forbidden: insufficient role'], 403);
        }

        return $next($request);
    }
}

