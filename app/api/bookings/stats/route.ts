import prisma from "@/lib/prisma";

// GET: สรุปจำนวนการจองและชั่วโมงที่จองแยกตามห้อง
// ตัวอย่าง: /api/bookings/stats?from=2026-10-28T00:00:00Z&to=2026-10-29T00:00:00Z
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const roomIdParam = searchParams.get("roomId");

    // ต้องระบุ from และ to ทั้งคู่
    if (!fromParam || !toParam) {
      return Response.json(
        { message: "กรุณาระบุ from และ to" },
        { status: 400 },
      );
    }

    const from = new Date(fromParam);
    const to = new Date(toParam);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return Response.json(
        { message: "รูปแบบวันที่ from หรือ to ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    if (from >= to) {
      return Response.json(
        { message: "from ต้องเป็นเวลาก่อน to" },
        { status: 400 },
      );
    }

    // ตรวจสอบ roomId ถ้ามีการส่งมา
    let roomId: number | undefined;

    if (roomIdParam !== null) {
      roomId = Number(roomIdParam);

      if (!Number.isInteger(roomId) || roomId <= 0) {
        return Response.json(
          { message: "roomId ต้องเป็นจำนวนเต็มมากกว่า 0" },
          { status: 400 },
        );
      }

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true },
      });

      if (!room) {
        return Response.json(
          { message: "ไม่พบข้อมูลห้องประชุม" },
          { status: 404 },
        );
      }
    }

    // เลือกรายการจองโดยใช้ startTime ในช่วง [from, to)
    const bookings = await prisma.booking.findMany({
      where: {
        startTime: {
          gte: from,
          lt: to,
        },
        ...(roomId !== undefined ? { roomId } : {}),
      },
      include: {
        room: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    // จัดกลุ่มสถิติตามห้อง
    const stats = new Map<
      number,
      {
        room: (typeof bookings)[number]["room"];
        bookingCount: number;
        totalBookedHours: number;
      }
    >();

    for (const booking of bookings) {
      const durationHours =
        (booking.endTime.getTime() - booking.startTime.getTime()) /
        (1000 * 60 * 60);

      const current = stats.get(booking.roomId);

      if (current) {
        current.bookingCount += 1;
        current.totalBookedHours += durationHours;
      } else {
        stats.set(booking.roomId, {
          room: booking.room,
          bookingCount: 1,
          totalBookedHours: durationHours,
        });
      }
    }

    const data = Array.from(stats.values()).map((item) => ({
      room: item.room,
      bookingCount: item.bookingCount,
      totalBookedHours: Number(item.totalBookedHours.toFixed(2)),
    }));

    return Response.json(
      {
        from: from.toISOString(),
        to: to.toISOString(),
        data,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to get booking stats:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการสรุปสถิติการจอง" },
      { status: 500 },
    );
  }
}
