# Authentication Foundation

This document explains the authentication flow, role-based access control (RBAC), and folder structure for the Event Marketplace backend.

## Folder Structure

The authentication and authorization logic is distributed across the following modules in `src/`:

- `auth/`: Handles JWT generation, login, and registration logic.
  - `guards/`: Contains `JwtAuthGuard`.
  - `strategies/`: Contains `JwtStrategy` for Passport.
  - `dto/`: Contains `LoginDto` and `RegisterDto`.
- `users/`: Handles CRUD operations for users and securely hashes passwords before saving to the DB.
  - `entities/`: Contains `UserEntity` with `@Exclude()` on sensitive fields.
- `roles/`: Handles fetching and managing roles.
  - `decorators/`: Contains `@Roles()` custom decorator.
  - `guards/`: Contains `RolesGuard` to check user roles against required roles.
- `common/`: Shared utilities.
  - `decorators/`: Contains `@CurrentUser()` to extract the user from the Request object.
- `prisma/`: Contains `PrismaService` to interface with the PostgreSQL database.

## Authentication Flow

1. **Registration (`POST /auth/register`)**:
   - The user submits their details (FirstName, LastName, Email, Password).
   - The `AuthService` queries the `RolesService` to fetch the default `CUSTOMER` role.
   - The payload is passed to `UsersService`, which hashes the password using `bcrypt` and creates the `User` in the database.
   - The `AuthService` generates and returns an Access Token and Refresh Token.

2. **Login (`POST /auth/login`)**:
   - The user submits their email and password.
   - The `AuthService` fetches the user from the database and verifies the password hash using `bcrypt.compare`.
   - On success, it returns an Access Token and Refresh Token.

3. **Protected Routes**:
   - Endpoints can be protected using the `@UseGuards(JwtAuthGuard)` decorator.
   - This guard automatically extracts the JWT from the `Authorization: Bearer <token>` header, verifies it, and calls `JwtStrategy.validate()` to fetch the user.
   - The user is attached to the Request object and can be accessed using the `@CurrentUser()` decorator.

## Role-Based Access Control (RBAC)

To restrict endpoints to specific roles:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@Get('admin-dashboard')
getAdminData() { ... }
```

- The `RolesGuard` checks the metadata set by `@Roles()` against the authenticated user's `role.name`.
- If the user does not have the required role, a `403 Forbidden` exception is thrown automatically.

## Security Practices Used

- **Password Hashing**: `bcrypt` is used with a salt round of 10.
- **Data Serialization**: `ClassSerializerInterceptor` is enabled globally. The `UserEntity` explicitly excludes `password` and `hashedRefreshToken` to ensure they are never accidentally sent to the client.
- **Stateless Authentication**: Access Tokens are short-lived JWTs.
- **DTO Validation**: Every incoming request body is validated against a DTO using `class-validator` and `ValidationPipe`.
