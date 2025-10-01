# Lab 16 - RESTful API 

### ป้อนข้อมูลนักศึกษา

รหัส นศ.: 670610682

ชื่อ-สกุล : นายชัยชาญ ชายสัก

### Content

- Current API
- Create route handlers for `/api/v2/users`
- JSON Web Token
- Role-based Access Control (RBAC)
- Token Authentication Middleware
- Check Role Middlewares
- Stores JWTs in User database

---

### Current API

**Route Handlers**

- `/api/v2/students` : CRUD API for Students data (in-memory DB)
- `/api/v3/students` : CRUD API for Students data (JSON file)
- `/api/v2/courses` : CRUD API for Courses data (in-memory DB) **NOT DONE!!**

**TypeScript interfaces**

Interface for main data are defined in `src/libs/types.ts`:

- `Student`
- `Course`
- `Enrollment`
- `User`

There are also other interfaces for JWT and Middleware

- `UserPayload` : Payload that stores authenticated user data
- `CustomRequest` : HTTP Request + some stuff

**In-memory DB**

Variables that stores data is defined in `src/db/db.ts`

- `students: Student[]` : students data
- `courses: Course[]` : courses data
- `enrollments: Entrollment[]` : enrollments data
- `users: User[]` : users data

There are some functions for reset variables above back to the `orignal` values as well.

- `reset_users(), reset_students(), reset_courses(), ...`

**JSON file**

Files that stores persistent data. (Not working in Vercel)

- `src/db/db_courses.json`
- `src/db/db_students.json`

Functions for `read`/`write` JSON file are defined in `src/db/db_transactions.ts`

**Middlewares**

- `express.json()`: extract and parsing JSON from request's body
- `morgan("dev")`: request logging
- `invalidJsonMiddleware`: check invalid JSON format in request's body
- `notFoundMiddleware` : check if endpoint/routes do not exist?

---

### Create Route Handlers for `/api/v2/users`

Create a file `src/routes/usersRoutes.ts`

```typescript
import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

import type { User, CustomRequest } from "../libs/types.js";

// import database
import { users, reset_users } from "../db/db.js";

const router = Router();

// GET /api/v2/users
router.get("/", (req: Request, res: Response) => {
  try {
    // return all users
    return res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

// POST /api/v2/users/login
router.post("/login", (req: Request, res: Response) => {
  // 1. get username and password from body

  // 2. check if user exists (search with username & password in DB)

  // 3. create JWT token (with user info object as payload) using JWT_SECRET_KEY
  //    (optional: save the token as part of User data)

  // 4. send HTTP response with JWT token

  return res.status(500).json({
    success: false,
    message: "POST /api/v2/users/login has not been implemented yet",
  });
});

// POST /api/v2/users/logout
router.post("/logout", (req: Request, res: Response) => {
  // 1. check Request if "authorization" header exists
  //    and container "Bearer ...JWT-Token..."

  // 2. extract the "...JWT-Token..." if available

  // 3. verify token using JWT_SECRET_KEY and get payload (username, studentId and role)

  // 4. check if user exists (search with username)

  // 5. proceed with logout process and return HTTP response
  //    (optional: remove the token from User data)

  return res.status(500).json({
    success: false,
    message: "POST /api/v2/users/logout has not been implemented yet",
  });
});

// POST /api/v2/users/reset
router.post("/reset", (req: Request, res: Response) => {
  try {
    reset_users();
    return res.status(200).json({
      success: true,
      message: "User database has been reset",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

export default router;
```

---

### JSON Web Token

- `JWT` is a `special string` that an `API server` generates once a user authenticates successfully.
- `JWT` string contains 3 parts : [ `HEADER`.`Payload`.`Signature` ]
- Client receives the `JWT` and **attachs the token to subsequent HTTP requests**
- Server verify received `JWT` and extracts `Payload` which may contain `user` and `role/permission` information then process them accordingly

[JWT Debugger](https://www.jwt.io/)

To create `JWT`, we can use this code pattern.

```typescript
// Get JWT_SECRET_KEY from .env file
const jwt_secret = process.env.JWT_SECRET || "this_is_my_secret";

// Create/sign a JWT with JWT_SECRET_KEY
// The payload is an object containing { username, studentId, role }
const token = jwt.sign(
  {
    // create JWT Payload
    username: "user4@abc.com",
    studentId: null,
    role: "ADMIN",
  },
  jwt_secret,
  { expiresIn: "5m" }
);
```

After that we can send `JWT` back to the client with `HTTP response`

```typescript
return res.status(200).json({
  success: true,
  message: "Login successful",
  token,
});
```

---

### Role-based Access Control (`RBAC`)

To allow only HTTP request from `ADMIN` to access `GET /api/v2/users`, we need to modify this route handler code.

```typescript
// GET /api/v2/users (ADMIN only)
router.get("/", (req: Request, res: Response) => {
  try {
    // 1. check Request if "authorization" header exists
    //    and container "Bearer ...JWT-Token..."

    // 2. extract the "...JWT-Token..." if available

    // 3. verify token using JWT_SECRET_KEY and get payload (username, studentId and role)

    // 4. check if user exists (search with username) and role is ADMIN

    // return all users
    return res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});
```

---

### Token Authentication Middleware

For any endpoint that only allows **authenticated user** to use, there are a few similar steps.

1. Check **HTTP Request** if `authorization` header exists and container `"Bearer ...JWT-Token..."`
2. Extract the `...JWT-Token...` if available
3. Verify `token` using **JWT_SECRET_KEY** and get `JWT payload` (username, studentId and role)

We can create a **middleware** to do this work and `use` the middleware on those endpoints.

Let's create `src/middlewares/authenMiddleware.ts`:

```typescript
import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

import { type CustomRequest, type UserPayload } from "../libs/types.js";

// interface CustomRequest extends Request {
//   user?: any; // Define the user property
//   token?: string; // Define the token property
// }

export const authenticateToken = (
  req: CustomRequest, // using a custom request
  res: Response,
  next: NextFunction
) => {
  // 1. check Request if "authorization" header exists
  //    and container "Bearer ...JWT-Token..."
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authorization header is required",
    });
  }

  // 2. extract the "...JWT-Token..." if available
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null)
    return res.status(401).json({
      success: false,
      message: "Token is required",
    });

  try {
    // 3. verify token using JWT_SECRET_KEY and
    //    get payload "user" = { username, studentId, role }
    const jwt_secret = process.env.JWT_SECRET || "this_is_my_secret";
    jwt.verify(token, jwt_secret, (err, user) => {
      if (err)
        return res.status(403).json({
          success: false,
          message: "Invalid or expired token",
        });

      // 4. Attach "user" payload and "other stuffs" to the custom request
      req.user = user as UserPayload;
      req.token = token;

      // 5. Proceed to next middleware or route handler
      next();
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong with authentication process",
      error: err,
    });
  }
};
```

Now we can use the `authenticateToken` middleware with the `GET /api/v2/users`.

```typescript
// GET /api/v2/users (ADMIN only)
router.get("/", authenticateToken, (req: Request, res: Response) => {
  try {
    // After the Request has been processed by 'authenticateToken' middleware
    // 1. Get "user payload" and "token" from (custom) request
    const payload = (req as CustomRequest).user;
    const token = (req as CustomRequest).token;

    // 2. check if user exists (search with username) and role is ADMIN

    // return all users
    return res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});
```

---

### Check Role Middlewares

There are many API endpoints that may require `ADMIN` access, for example:

**Users**

- `POST /api/v2/users`
- `PUT /api/v2/users`
- `DELETE /api/v2/users`

**Courses**

- `POST /api/v2/courses`
- `PUT /api/v2/courses`
- `DELETE /api/v2/courses`

**Students**

- `GET /api/v2/students`
- `POST /api/v2/students`
- `PUT /api/v2/students`
- `DELETE /api/v2/students`

And there are some endpoints that should be accessible by both `ADMIN` and `STUDENT`.

`GET /api/v2/students/:studentId`

- `ADMIN` should be able to access data of all students.
- Only `STUDENT` who has the same `studentId` can access his/her data.

We can create `checkRoleAdmin` middlewares to help checking `ADMIN` role by creating `src/middlewares/checkRoleAdminMiddleware.ts`

```typescript
// src/middlewares/checkRoleAdminMiddleware.ts
import { type Request, type Response, type NextFunction } from "express";
import { type CustomRequest, type User } from "../libs/types.js";
import { users } from "../db/db.js";

// interface CustomRequest extends Request {
//   user?: any; // Define the user property
//   token?: string; // Define the token property
// }

export const checkRoleAdmin = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  // 1. get "user payload" and "token" from (custom) request
  const payload = req.user;
  const token = req.token;

  // 2. check if user exists (search with username) and role is ADMIN
  const user = users.find((u: User) => u.username === payload?.username);
  if (!user || user.role !== "ADMIN") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized user",
    });
  }

  // (optional) check if token exists in user data

  // Proceed to next middleware or route handler
  next();
};
```

We can also create `checkRoles` middlewares to help checking if a user is existed by creating `src/middlewares/checkRolesMiddleware.ts`

```typescript
// src/middlewares/checkRolesMiddleware.ts
import { type Request, type Response, type NextFunction } from "express";
import { type CustomRequest, type User } from "../libs/types.js";
import { users, reset_users } from "../db/db.js";

// interface CustomRequest extends Request {
//   user?: any; // Define the user property
//   token?: string; // Define the token property
// }

export const checkRoles = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  // 1. get "user payload" and "token" from (custom) request
  const payload = req.user;
  const token = req.token;

  // 2. check if user exists (search with username)
  const user = users.find((u: User) => u.username === payload?.username);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized user",
    });
  }

  // (optional) check if token exists in user data

  // Proceed to next middleware or route handler
  next();
};
```

Let's use `checkRoleAdmin` with `GET /api/v2/users` to allow only ADMIN access.

```typescript
// GET /api/v2/users (ADMIN only)
router.get(
  "/",
  authenticateToken, // verify token and extract "user payload"
  checkRoleAdmin, // check User exists and ADMIN role
  (req: Request, res: Response) => {
    try {
      // return all users
      return res.json({
        success: true,
        data: users,
      });
    } catch (err) {
      return res.status(200).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  }
);
```

For the `GET /api/v2/students/:studentId` endpoint, we will use `checkRoles` middleware.

```typescript
// GET /api/v2/students/{studentId}
router.get(
  "/:studentId",
  authenticateToken,
  checkRoles,
  (req: Request, res: Response) => {
    try {
      ...

      // 1. get "user payload" from (custom) request
      const payload = (req as CustomRequest).user;

      // 2. get "studentId" from endpoint param and validate with Zod
      const studentId = req.params.studentId;
      const parseResult = zStudentId.safeParse(studentId);
      ...

      // if role is STUDENT, user can only access their own data
      if (payload?.role === "STUDENT" && payload?.studentId !== studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      // proceed with search with studentId and return results
      ...

    }
  }
);
```

---

### Stores JWTs in User database

So far, we do not store any `JWT` of any authenticated users.

- We do not know how many `JWT` the server have generated.
- We do not know how many `JWT` belongs to each user.

Let's try storing `JWT` as part of each user's data, for example:

```json
[
  {
    "username": "user3@abc.com",
    "password": "1234",
    "studentId": "650610003",
    "role": "STUDENT",
    "tokens": [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InVzZXIzQGFiYy5jb20iLCJzdHVkZW50SWQiOiI2NTA2MTAwMDMiLCJyb2xlIjoiU1RVREVOVCIsImlhdCI6MTc1ODczMjI5MiwiZXhwIjoxNzU4NzMyNTkyfQ.HpZRo8wAC2SrfDcqS8KfgfyPEbAhdwaFeJ0CEy5-i5M",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InVzZXIzQGFiYy5jb20iLCJzdHVkZW50SWQiOiI2NTA2MTAwMDMiLCJyb2xlIjoiU1RVREVOVCIsImlhdCI6MTc1ODczMjI5NiwiZXhwIjoxNzU4NzMyNTk2fQ.AMAbve9SezmViPBQy9G044g-lXS_anGwlvZa8X8brps"
    ]
  },
  {
    "username": "user4@abc.com",
    "password": "5678",
    "studentId": null,
    "role": "ADMIN",
    "tokens": [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InVzZXI0QGFiYy5jb20iLCJzdHVkZW50SWQiOm51bGwsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc1ODczMjMxMCwiZXhwIjoxNzU4NzMyNjEwfQ.NB435PtafbLgrT-FizbLi_9Bpo7TG8ACL2LVaSDFmbs"
    ]
  }
]
```

We will create and store a `JWT` when a client authenticates user successfully with `POST /api/v2/users/login` endpoint.

```typescript
// src/routes/usersRouters.ts
import { users, reset_users } from "../db/db.js";

// POST /api/v2/users/login
router.post("/login", (req: Request, res: Response) => {
  try {

    // create/sign JWT and the user exists

    // store the new token in user.tokens
    user.tokens = user.tokens ? [...user.tokens, token] : [token];

    // return HTTP response with token
  }
  ...
});

```

And after successfully logout with `POST /api/v2/users/logout` endpoint, we will remove the attached with the request from user's data.

Note that, we use `authenticateToken` with this endpoint.

```typescript
// src/routes/usersRouters.ts

// POST /api/v2/users/logout
router.post("/logout", authenticateToken, (req: Request, res: Response) => {
  try {
    ...

    // get token

    // check if token exists in user.tokens
    if (!user.tokens || !user.tokens.includes(token)) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // if token exists, remove the token from user.tokens
    user.tokens = user.tokens?.filter((t) => t !== token);

    // return HTTP response with successful message
  }
  ...
});
```
