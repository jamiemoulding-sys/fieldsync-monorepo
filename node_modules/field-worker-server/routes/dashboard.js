const express = require("express");
const router = express.Router();

const { query } = require("../database/connection");
const logger = require("../utils/logger");
const {
  authenticateToken,
  requireCompany,
  requireRole,
} = require("../middleware/auth");

function getHolidayAllowance(profile) {
  return Number(
    profile?.holiday_allowance ??
      profile?.holiday_days ??
      profile?.annual_leave ??
      20
  );
}

function getUsedHolidayDays(holidays, userId) {
  const approved = holidays.filter(
    (holiday) => holiday.user_id === userId && holiday.status === "approved"
  );

  let total = 0;

  approved.forEach((request) => {
    const end = new Date(request.end_date);
    const day = new Date(request.start_date);

    while (day <= end) {
      const dayOfWeek = day.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) total++;
      day.setDate(day.getDate() + 1);
    }
  });

  return total;
}

const MOBILE_SECTION_TIMEOUT_MS = Number(
  process.env.MOBILE_DASHBOARD_SECTION_TIMEOUT_MS || 3500
);

async function loadMobileDashboardSection(name, fallback, loader) {
  const start = Date.now();
  logger.info("Mobile dashboard section start", { section: name });

  let timeoutId;
  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error(`${name} timed out`);
        error.code = "SECTION_TIMEOUT";
        reject(error);
      }, MOBILE_SECTION_TIMEOUT_MS);
    });

    const value = await Promise.race([loader(), timeout]);
    clearTimeout(timeoutId);
    logger.info("Mobile dashboard section complete", {
      section: name,
      duration: Date.now() - start,
    });
    return { name, value, error: null };
  } catch (error) {
    clearTimeout(timeoutId);
    logger.warn("Mobile dashboard section fallback", {
      section: name,
      duration: Date.now() - start,
      reason: error.code || error.message,
    });
    return { name, value: fallback, error: error.code || error.message };
  }
}

//
// ===================================
// 📊 FULL FIX DASHBOARD ROUTE
// ===================================

router.get(
  "/",
  authenticateToken,
  requireCompany,
  requireRole("manager"),
  async (req, res) => {
    try {
      const companyId =
        req.user.companyId;

      if (!companyId) {
        return res.status(403).json({
          error:
            "No company assigned",
        });
      }

      const safeQuery = async (
        sql,
        params = []
      ) => {
        try {
          return await query(
            sql,
            params
          );
        } catch {
          return {
            rows: [],
          };
        }
      };

      const [
        usersRes,
        activeShiftsRes,
        tasksRes,
        holidayRes,
        shiftsTodayRes,
        hoursTodayRes,
        lateTodayRes,
      ] = await Promise.all([
        safeQuery(
          `
          SELECT COUNT(*) FROM users
          WHERE company_id = $1
          `,
          [companyId]
        ),

        safeQuery(
          `
          SELECT COUNT(*) FROM shifts
          WHERE company_id = $1
          AND clock_out_time IS NULL
          `,
          [companyId]
        ),

        safeQuery(
          `
          SELECT COUNT(*) FROM tasks
          WHERE company_id = $1
          `,
          [companyId]
        ),

        safeQuery(
          `
          SELECT COUNT(*) FROM holidays h
          JOIN users u
          ON h.user_id = u.id
          WHERE u.company_id = $1
          AND h.status = 'pending'
          `,
          [companyId]
        ),

        safeQuery(
          `
          SELECT COUNT(*) FROM shifts
          WHERE company_id = $1
          AND DATE(clock_in_time) = CURRENT_DATE
          `,
          [companyId]
        ),

        safeQuery(
          `
          SELECT COALESCE(
            SUM(
              EXTRACT(
                EPOCH FROM (
                  COALESCE(
                    clock_out_time,
                    NOW()
                  ) - clock_in_time
                )
              ) / 3600
            ),0
          ) AS total
          FROM shifts
          WHERE company_id = $1
          AND DATE(clock_in_time) = CURRENT_DATE
          `,
          [companyId]
        ),

        safeQuery(
          `
          SELECT COUNT(*) FROM shifts
          WHERE company_id = $1
          AND DATE(clock_in_time) = CURRENT_DATE
          AND is_late = true
          `,
          [companyId]
        ),
      ]);

      const hoursRes =
        await safeQuery(
          `
          SELECT
            DATE(clock_in_time) AS date,
            ROUND(
              SUM(
                EXTRACT(
                  EPOCH FROM (
                    COALESCE(
                      clock_out_time,
                      NOW()
                    ) - clock_in_time
                  )
                ) / 3600
              )
            ) AS hours
          FROM shifts
          WHERE company_id = $1
          AND clock_in_time >= NOW() - INTERVAL '7 days'
          GROUP BY DATE(clock_in_time)
          ORDER BY DATE(clock_in_time)
          `,
          [companyId]
        );

      const topUsersRes =
        await safeQuery(
          `
          SELECT
            u.name,
            COUNT(s.id) AS shifts
          FROM shifts s
          JOIN users u
          ON u.id = s.user_id
          WHERE u.company_id = $1
          GROUP BY u.name
          ORDER BY shifts DESC
          LIMIT 5
          `,
          [companyId]
        );

      const activityRes =
        await safeQuery(
          `
          SELECT
            a.*,
            u.name
          FROM activity_logs a
          JOIN users u
          ON u.id = a.user_id
          WHERE a.company_id = $1
          ORDER BY a.created_at DESC
          LIMIT 10
          `,
          [companyId]
        );

      const getCount = (
        result
      ) =>
        Number(
          result?.rows?.[0]
            ?.count || 0
        );

      const getTotal = (
        result
      ) =>
        Number(
          result?.rows?.[0]
            ?.total || 0
        );

      const late =
        getCount(
          lateTodayRes
        );

      const active =
        getCount(
          activeShiftsRes
        );

      const holidays =
        getCount(
          holidayRes
        );

      const aiFeed = [];

      if (late > 0) {
        aiFeed.push(
          `🚨 ${late} employees late today`
        );
      }

      if (active < 2) {
        aiFeed.push(
          "⚠️ Low staffing levels right now"
        );
      }

      if (holidays > 0) {
        aiFeed.push(
          `📨 ${holidays} holiday requests pending`
        );
      }

      if (
        aiFeed.length === 0
      ) {
        aiFeed.push(
          "✅ Operations running smoothly"
        );
      }

      return res.json({
        stats: {
          users:
            getCount(
              usersRes
            ),
          activeShifts:
            active,
          tasks:
            getCount(
              tasksRes
            ),
          pendingHolidays:
            holidays,
          shiftsToday:
            getCount(
              shiftsTodayRes
            ),
          hoursToday:
            Math.round(
              getTotal(
                hoursTodayRes
              )
            ),
          late,
          issues: late,
        },

        trends: {
          hours:
            hoursRes.rows ||
            [],
        },

        topPerformers:
          topUsersRes.rows ||
          [],

        activity:
          activityRes.rows ||
          [],

        aiFeed,
      });
    } catch (error) {
      console.error(
        "DASHBOARD ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to load dashboard",
      });
    }
  }
);

router.get(
  "/mobile",
  authenticateToken,
  requireCompany,
  async (req, res) => {
    try {
      const companyId = req.user.companyId;
      const userId = req.user.id;

      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      const diff = (weekStart.getDay() - 1 + 7) % 7;
      weekStart.setDate(weekStart.getDate() - diff);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const yearStart = new Date(todayStart.getFullYear(), 0, 1);
      const yearEnd = new Date(todayStart.getFullYear() + 1, 0, 1);

      const sections = await Promise.all([
        loadMobileDashboardSection("today_schedule", { rows: [] }, () =>
          query(
          `
          SELECT
            s.*,
            CASE
              WHEN l.id IS NULL THEN NULL
              ELSE json_build_object(
                'id', l.id,
                'name', l.name,
                'address', l.address,
                'latitude', l.latitude,
                'longitude', l.longitude,
                'radius', l.radius
              )
            END AS locations
          FROM schedules s
          LEFT JOIN locations l
            ON l.id = s.location_id
            AND l.company_id = s.company_id
          WHERE s.user_id = $1
          AND s.company_id = $2
          AND s.start_time >= $3
          AND s.start_time < $4
          ORDER BY s.start_time ASC
          LIMIT 1
          `,
          [userId, companyId, todayStart.toISOString(), todayEnd.toISOString()]
          )
        ),
        loadMobileDashboardSection("week_schedule", { rows: [] }, () =>
          query(
          `
          SELECT
            s.*,
            CASE
              WHEN l.id IS NULL THEN NULL
              ELSE json_build_object(
                'id', l.id,
                'name', l.name,
                'address', l.address,
                'latitude', l.latitude,
                'longitude', l.longitude,
                'radius', l.radius
              )
            END AS locations
          FROM schedules s
          LEFT JOIN locations l
            ON l.id = s.location_id
            AND l.company_id = s.company_id
          WHERE s.user_id = $1
          AND s.company_id = $2
          AND s.start_time >= $3
          AND s.start_time < $4
          ORDER BY s.start_time ASC
          LIMIT 20
          `,
          [userId, companyId, weekStart.toISOString(), weekEnd.toISOString()]
          )
        ),
        loadMobileDashboardSection("week_shifts", { rows: [] }, () =>
          query(
          `
          SELECT
            s.*,
            CASE
              WHEN l.id IS NULL THEN NULL
              ELSE json_build_object(
                'id', l.id,
                'name', l.name
              )
            END AS locations
          FROM shifts s
          LEFT JOIN locations l
            ON l.id = s.location_id
            AND l.company_id = s.company_id
          WHERE s.user_id = $1
          AND s.company_id = $2
          AND s.clock_in_time >= $3
          ORDER BY s.clock_in_time DESC
          LIMIT 40
          `,
          [userId, companyId, weekStart.toISOString()]
          )
        ),
        loadMobileDashboardSection("active_shift", { rows: [] }, () =>
          query(
          `
          SELECT *
          FROM shifts
          WHERE user_id = $1
          AND company_id = $2
          AND clock_out_time IS NULL
          ORDER BY clock_in_time DESC
          LIMIT 1
          `,
          [userId, companyId]
          )
        ),
        loadMobileDashboardSection("holidays", { rows: [] }, () =>
          query(
          `
          SELECT user_id, status, start_date, end_date
          FROM holidays
          WHERE company_id = $1
          AND user_id = $2
          AND status = 'approved'
          AND end_date >= $3
          AND start_date < $4
          ORDER BY start_date DESC
          LIMIT 100
          `,
          [companyId, userId, yearStart.toISOString(), yearEnd.toISOString()]
          )
        ),
        loadMobileDashboardSection("announcement", { rows: [] }, () =>
          query(
          `
          SELECT id, title, message, priority, expires_at, created_at
          FROM announcements
          WHERE company_id = $1
          AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [companyId]
          )
        ),
      ]);

      const sectionByName = Object.fromEntries(
        sections.map((section) => [section.name, section])
      );

      const todayScheduleRes = sectionByName.today_schedule.value;
      const weekScheduleRes = sectionByName.week_schedule.value;
      const weekShiftsRes = sectionByName.week_shifts.value;
      const activeShiftRes = sectionByName.active_shift.value;
      const holidaysRes = sectionByName.holidays.value;
      const announcementRes = sectionByName.announcement.value;

      const activeShift = activeShiftRes.rows[0] || null;
      const holidays = holidaysRes.rows || [];
      const allowance = getHolidayAllowance(req.user);
      const used = getUsedHolidayDays(holidays, userId);
      const sectionErrors = sections
        .filter((section) => section.error)
        .map((section) => ({
          section: section.name,
          reason: section.error,
        }));

      return res.json({
        profile: req.user,
        today_shift: todayScheduleRes.rows[0] || null,
        week_schedule: weekScheduleRes.rows || [],
        week_shifts: weekShiftsRes.rows || [],
        clock_state: {
          activeShift,
          active_shift: activeShift,
          on_break: activeShift ? !!activeShift.break_started_at : false,
        },
        holiday_summary: {
          allowance,
          remaining: Math.max(allowance - used, 0),
        },
        announcement: announcementRes.rows[0] || null,
        partial: sectionErrors.length > 0,
        section_errors: sectionErrors,
      });
    } catch (error) {
      console.error("MOBILE DASHBOARD ERROR:", error);
      return res.status(500).json({
        error: "Failed to load mobile dashboard",
      });
    }
  }
);

module.exports = router;
