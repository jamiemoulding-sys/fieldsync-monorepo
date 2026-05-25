const http = require("http");
const express = require("express");

const usersById = {
  "employee-a": {
    id: "employee-a",
    email: "employee-a@example.com",
    name: "Employee A",
    role: "employee",
    company_id: "company-a",
    is_active: true,
    status: "active",
    company_name: "Company A",
  },
  "employee-b": {
    id: "employee-b",
    email: "employee-b@example.com",
    name: "Employee B",
    role: "employee",
    company_id: "company-b",
    is_active: true,
    status: "active",
    company_name: "Company B",
  },
  "manager-a": {
    id: "manager-a",
    email: "manager-a@example.com",
    name: "Manager A",
    role: "manager",
    company_id: "company-a",
    is_active: true,
    status: "active",
    company_name: "Company A",
  },
  "admin-a": {
    id: "admin-a",
    email: "admin-a@example.com",
    name: "Admin A",
    role: "admin",
    company_id: "company-a",
    is_active: true,
    status: "active",
    company_name: "Company A",
  },
};

const tokenToUserId = {
  "employee-a-token": "employee-a",
  "employee-b-token": "employee-b",
  "manager-a-token": "manager-a",
  "admin-a-token": "admin-a",
};

let queryMock;
let signedUrlMock;

function jsonResponse(rows = []) {
  return Promise.resolve({ rows });
}

function setupMocks() {
  jest.resetModules();

  signedUrlMock = jest.fn().mockResolvedValue({
    data: { signedUrl: "https://signed.example/payslip.pdf" },
    error: null,
  });

  jest.doMock("@supabase/supabase-js", () => ({
    createClient: jest.fn(() => ({
      auth: {
        getUser: jest.fn(async (token) => {
          const id = tokenToUserId[token];
          return id
            ? { data: { user: { id } }, error: null }
            : { data: { user: null }, error: { message: "Invalid token" } };
        }),
      },
      storage: {
        from: jest.fn(() => ({
          createSignedUrl: signedUrlMock,
        })),
      },
    })),
  }));

  queryMock = jest.fn(async (sql, params = []) => {
    if (sql.includes("FROM users u") && sql.includes("LEFT JOIN companies c")) {
      const user = usersById[params[0]];
      return { rows: user ? [user] : [] };
    }

    if (sql.includes("FROM shifts") && sql.includes("WHERE id = $1")) {
      const [shiftId, userId, companyId] = params;
      return jsonResponse(
        Number(shiftId) === 101 && userId === "employee-a" && companyId === "company-a"
          ? [{ id: 101 }]
          : []
      );
    }

    if (sql.includes("FROM shifts") && sql.includes("clock_out_time IS NULL")) {
      const [userId, companyId] = params;
      if (userId === "employee-a" && companyId === "company-a") {
        return jsonResponse([
          {
            id: 101,
            user_id: userId,
            company_id: companyId,
            clock_in_time: "2026-05-25T08:00:00.000Z",
            break_started_at: null,
          },
        ]);
      }
      return jsonResponse([]);
    }

    if (sql.includes("FROM schedules s") && sql.includes("JOIN users u")) {
      const [companyId] = params;
      return jsonResponse(
        companyId === "company-a"
          ? [
              {
                id: 201,
                user_id: "employee-a",
                company_id: "company-a",
                date: "2026-05-25",
                start_time: "2026-05-25T09:00:00.000Z",
                end_time: "2026-05-25T17:00:00.000Z",
              },
            ]
          : []
      );
    }

    if (sql.includes("FROM users WHERE id = $1 AND company_id = $2")) {
      const [userId, companyId] = params;
      const user = usersById[userId];
      return jsonResponse(user && user.company_id === companyId ? [{ id: userId }] : []);
    }

    if (sql.includes("INSERT INTO schedules")) {
      return jsonResponse([
        {
          id: 202,
          user_id: params[0],
          date: params[1],
          start_time: params[2],
          end_time: params[3],
          company_id: params[4],
        },
      ]);
    }

    if (sql.includes("INSERT INTO shift_route_logs")) {
      return jsonResponse([
        {
          id: 301,
          shift_id: params[0],
          created_at: "2026-05-25T08:05:00.000Z",
        },
      ]);
    }

    if (sql.includes("INSERT INTO audit_logs")) {
      return jsonResponse([{ id: "audit-1" }]);
    }

    if (sql.includes("FROM payslips p") && sql.includes("ORDER BY")) {
      const paramsText = JSON.stringify(params);
      return jsonResponse([
        {
          id: "payslip-a",
          company_id: params[0],
          employee_id: paramsText.includes("employee-a") ? "employee-a" : "employee-a",
          employee_name: "Employee A",
          employee_email: "employee-a@example.com",
          pay_period_start: "2026-05-01",
          pay_period_end: "2026-05-15",
          gross_pay: "1000.00",
          net_pay: "800.00",
          hours_worked: "40.00",
          file_path: "company-a/employee-a/payslip.pdf",
          created_at: "2026-05-16T00:00:00.000Z",
          sent_at: "2026-05-16T00:00:00.000Z",
        },
      ]);
    }

    if (sql.includes("FROM payslips p") && sql.includes("WHERE p.id = $1")) {
      const [id, companyId, employeeId] = params;
      if (id === "payslip-a" && companyId === "company-a" && (!employeeId || employeeId === "employee-a")) {
        return jsonResponse([
          {
            id,
            company_id: companyId,
            employee_id: "employee-a",
            employee_name: "Employee A",
            employee_email: "employee-a@example.com",
            pay_period_start: "2026-05-01",
            pay_period_end: "2026-05-15",
            gross_pay: "1000.00",
            net_pay: "800.00",
            hours_worked: "40.00",
            file_path: "company-a/employee-a/payslip.pdf",
            created_at: "2026-05-16T00:00:00.000Z",
            sent_at: "2026-05-16T00:00:00.000Z",
          },
        ]);
      }
      return jsonResponse([]);
    }

    if (sql.includes("INSERT INTO holidays")) {
      return jsonResponse([
        {
          id: 401,
          user_id: params[0],
          start_date: params[1],
          end_date: params[2],
          status: params[3],
          company_id: params[4],
        },
      ]);
    }

    if (sql.includes("FROM holidays h")) {
      return jsonResponse([
        {
          id: 401,
          user_id: "employee-a",
          company_id: params[0],
          status: "pending",
          start_date: "2026-06-01",
          end_date: "2026-06-02",
          name: "Employee A",
        },
      ]);
    }

    if (sql.includes("UPDATE holidays")) {
      return jsonResponse([{ id: params[3], company_id: params[4], status: params[0] }]);
    }

    if (sql.includes("DELETE FROM holidays")) {
      return jsonResponse([{ id: params[0] }]);
    }

    return jsonResponse([]);
  });

  jest.doMock("../database/connection", () => ({
    query: queryMock,
  }));
}

async function withServer(app, callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require("../routes/auth"));
  app.use("/api/shifts", require("../routes/shifts"));
  app.use("/api/tracking", require("../routes/tracking"));
  app.use("/api/payslips", require("../routes/payslips"));
  app.use("/api/schedules", require("../routes/schedules"));
  return app;
}

describe("backend auth and company scoping", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.JWT_SECRET;
    setupMocks();
  });

  afterEach(() => {
    jest.dontMock("@supabase/supabase-js");
    jest.dontMock("../database/connection");
  });

  test("unauthenticated protected requests are rejected", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/me`);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "No token provided" });
    });
  });

  test("/api/auth/me returns hydrated normalized req.user", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: authHeader("employee-a-token"),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user).toEqual(
        expect.objectContaining({
          id: "employee-a",
          email: "employee-a@example.com",
          role: "employee",
          company_id: "company-a",
          companyId: "company-a",
        })
      );
    });
  });

  test("/api/shifts/state is scoped to authenticated employee company", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/shifts/state`, {
        headers: authHeader("employee-a-token"),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.active_shift.company_id).toBe("company-a");
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("FROM shifts"),
        ["employee-a", "company-a"]
      );
    });
  });

  test("employees cannot access role-restricted schedule writes", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/schedules`, {
        method: "POST",
        headers: {
          ...authHeader("employee-a-token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: "employee-a",
          date: "2026-05-25",
          start_time: "2026-05-25T09:00:00.000Z",
          end_time: "2026-05-25T17:00:00.000Z",
        }),
      });

      expect(response.status).toBe(403);
    });
  });

  test("manager schedule reads and writes are company-scoped", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const listResponse = await fetch(`${baseUrl}/api/schedules`, {
        headers: authHeader("manager-a-token"),
      });
      const schedules = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(schedules).toHaveLength(1);
      expect(schedules[0].company_id).toBe("company-a");

      const createResponse = await fetch(`${baseUrl}/api/schedules`, {
        method: "POST",
        headers: {
          ...authHeader("manager-a-token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: "employee-a",
          date: "2026-05-26",
          start_time: "2026-05-26T09:00:00.000Z",
          end_time: "2026-05-26T17:00:00.000Z",
        }),
      });
      const created = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(created.company_id).toBe("company-a");
    });
  });

  test("tracking ping requires authenticated employee and active in-company shift", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const managerResponse = await fetch(`${baseUrl}/api/tracking/pings`, {
        method: "POST",
        headers: {
          ...authHeader("manager-a-token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shift_id: 101,
          latitude: 51.5,
          longitude: -0.1,
        }),
      });

      expect(managerResponse.status).toBe(403);

      const employeeResponse = await fetch(`${baseUrl}/api/tracking/pings`, {
        method: "POST",
        headers: {
          ...authHeader("employee-a-token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shift_id: 101,
          latitude: 51.5,
          longitude: -0.1,
          accuracy: 10,
        }),
      });
      const body = await employeeResponse.json();

      expect(employeeResponse.status).toBe(201);
      expect(body.ping).toEqual(
        expect.objectContaining({
          id: 301,
          shift_id: 101,
        })
      );
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO shift_route_logs"),
        expect.arrayContaining([101, "employee-a", "company-a"])
      );
    });
  });

  test("payslip list and detail enforce authenticated company and employee access", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const listResponse = await fetch(`${baseUrl}/api/payslips`, {
        headers: authHeader("employee-a-token"),
      });
      const listBody = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(listBody.payslips[0]).toEqual(
        expect.objectContaining({
          company_id: "company-a",
          employee_id: "employee-a",
          has_file: true,
        })
      );

      const detailResponse = await fetch(`${baseUrl}/api/payslips/payslip-a`, {
        headers: authHeader("employee-a-token"),
      });
      const detailBody = await detailResponse.json();

      expect(detailResponse.status).toBe(200);
      expect(detailBody.view_url).toBe("https://signed.example/payslip.pdf");
      expect(signedUrlMock).toHaveBeenCalledWith(
        "company-a/employee-a/payslip.pdf",
        300,
        undefined
      );
    });
  });

  test("holiday endpoints require auth, company scope, and manager/admin for approval/delete", async () => {
    const app = createApp();

    await withServer(app, async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/schedules/holiday-requests`, {
        method: "POST",
        headers: {
          ...authHeader("employee-a-token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_date: "2026-06-01",
          end_date: "2026-06-02",
          user_id: "employee-b",
        }),
      });
      const created = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(created.user_id).toBe("employee-a");
      expect(created.company_id).toBe("company-a");

      const employeeApprove = await fetch(`${baseUrl}/api/schedules/holiday-requests/401`, {
        method: "PUT",
        headers: {
          ...authHeader("employee-a-token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "approved" }),
      });

      expect(employeeApprove.status).toBe(403);

      const managerApprove = await fetch(`${baseUrl}/api/schedules/holiday-requests/401`, {
        method: "PUT",
        headers: {
          ...authHeader("manager-a-token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "approved" }),
      });

      expect(managerApprove.status).toBe(200);

      const employeeDelete = await fetch(`${baseUrl}/api/schedules/holiday-requests/401`, {
        method: "DELETE",
        headers: authHeader("employee-a-token"),
      });

      expect(employeeDelete.status).toBe(403);
    });
  });
});
