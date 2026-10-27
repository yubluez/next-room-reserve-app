import prisma from "@/lib/prisma";

// GET: แสดงรายการจอง พร้อมข้อมูลห้อง ค้นหา กรอง และแบ่งหน้า
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const roomIdParam = searchParams.get("roomId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const pageParam = searchParams.get("page") ?? "1";
    const limitParam = searchParams.get("limit") ?? "10";

    const page = Number(pageParam);
    const limit = Number(limitParam);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return Response.json(
        {
          message:
            "page ต้องเป็นจำนวนเต็มตั้งแต่ 1 และ limit ต้องอยู่ระหว่าง 1–100",
        },
        { status: 400 },
      );
    }

    let roomId: number | undefined;

    if (roomIdParam !== null) {
      roomId = Number(roomIdParam);

      if (!Number.isInteger(roomId) || roomId <= 0) {
        return Response.json({ message: "roomId ไม่ถูกต้อง" }, { status: 400 });
      }
    }

    if ((from && !to) || (!from && to)) {
      return Response.json(
        { message: "กรุณาระบุ from และ to พร้อมกัน หรือไม่ระบุทั้งคู่" },
        { status: 400 },
      );
    }

    let startTimeFilter = {};

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);

      if (
        Number.isNaN(fromDate.getTime()) ||
        Number.isNaN(toDate.getTime()) ||
        fromDate >= toDate
      ) {
        return Response.json(
          { message: "ช่วงวันที่ไม่ถูกต้อง โดย from ต้องอยู่ก่อน to" },
          { status: 400 },
        );
      }

      startTimeFilter = {
        startTime: {
          gte: fromDate,
          lt: toDate,
        },
      };
    }

    const where = {
      ...(roomId !== undefined ? { roomId } : {}),
      ...startTimeFilter,
      ...(search
        ? {
            OR: [
              { bookerName: { contains: search } },
              { purpose: { contains: search } },
              {
                room: {
                  roomName: { contains: search },
                },
              },
              {
                room: {
                  roomCode: { contains: search },
                },
              },
            ],
          }
        : {}),
    };

    const [bookings, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where,
        include: {
          room: true,
        },
        orderBy: {
          startTime: "asc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return Response.json(
      {
        data: bookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to get bookings:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการดึงรายการจอง" },
      { status: 500 },
    );
  }
}

// POST: เพิ่มรายการจองห้องประชุม
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { message: "รูปแบบข้อมูลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const { roomId, bookerName, purpose, startTime, endTime, attendeeCount } =
      body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (
      !Number.isInteger(roomId) ||
      roomId <= 0 ||
      typeof bookerName !== "string" ||
      bookerName.trim() === "" ||
      typeof purpose !== "string" ||
      purpose.trim() === "" ||
      typeof startTime !== "string" ||
      startTime.trim() === "" ||
      typeof endTime !== "string" ||
      endTime.trim() === "" ||
      !Number.isInteger(attendeeCount) ||
      attendeeCount <= 0
    ) {
      return Response.json(
        {
          message:
            "กรุณาระบุ roomId, bookerName, purpose, startTime, endTime และ attendeeCount ให้ถูกต้อง",
        },
        { status: 400 },
      );
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return Response.json(
        { message: "รูปแบบวันที่ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // เวลาเริ่มต้องอยู่ในอนาคต
    if (startDate <= new Date()) {
      return Response.json(
        { message: "เวลาเริ่มจองต้องอยู่ในอนาคต" },
        { status: 400 },
      );
    }

    if (startDate >= endDate) {
      return Response.json(
        { message: "เวลาเริ่มต้องอยู่ก่อนเวลาสิ้นสุด" },
        { status: 400 },
      );
    }

    // ตรวจสอบว่าห้องมีอยู่จริง
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return Response.json(
        { message: "ไม่พบห้องประชุมที่ระบุ" },
        { status: 404 },
      );
    }

    // จำนวนผู้เข้าร่วมต้องไม่เกินความจุห้อง
    if (attendeeCount > room.capacity) {
      return Response.json(
        { message: "จำนวนผู้เข้าร่วมเกินความจุของห้อง" },
        { status: 400 },
      );
    }

    // ตรวจสอบว่ามีรายการจองที่เวลาทับซ้อนหรือไม่
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        startTime: {
          lt: endDate,
        },
        endTime: {
          gt: startDate,
        },
      },
    });

    if (overlappingBooking) {
      return Response.json(
        { message: "ช่วงเวลานี้มีรายการจองห้องแล้ว" },
        { status: 409 },
      );
    }

    const booking = await prisma.booking.create({
      data: {
        roomId,
        bookerName: bookerName.trim(),
        purpose: purpose.trim(),
        startTime: startDate,
        endTime: endDate,
        attendeeCount,
      },
      include: {
        room: true,
      },
    });

    return Response.json(booking, { status: 201 });
  } catch (error) {
    console.error("Failed to create booking:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการเพิ่มรายการจอง" },
      { status: 500 },
    );
  }
}
