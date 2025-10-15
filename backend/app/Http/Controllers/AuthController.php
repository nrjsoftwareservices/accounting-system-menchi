<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::min(8)],
            'organization' => 'required|array',
            'organization.name' => 'required|string',
            'organization.code' => 'required|string|unique:organizations,code',
            'organization.default_currency' => 'nullable|string|size:3',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        $org = Organization::create([
            'uuid' => (string) Str::uuid(),
            'name' => $data['organization']['name'],
            'code' => $data['organization']['code'],
            'default_currency' => $data['organization']['default_currency'] ?? 'USD',
        ]);

        $org->users()->attach($user->id, ['role' => 'admin']);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
            'organization' => $org,
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $data['email'])->first();
        if (!$user || !Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }
        $token = $user->createToken('api')->plainTextToken;
        $orgs = $user->belongsToMany(Organization::class, 'user_organizations')->get();
        return response()->json(['token' => $token, 'user' => $user, 'organizations' => $orgs]);
    }
}

