import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: แสดงรายการจองของห้องตาม ID
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const roomId = Number(id);

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return Response.json({ message: "ID ห้องไม่ถูกต้อง" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return Response.json(
        { message: "ไม่พบข้อมูลห้องประชุม" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // ต้องส่ง from และ to มาพร้อมกัน หรือไม่ส่งเลย
    if ((from && !to) || (!from && to)) {
      return Response.json(
        {
          message: "กรุณาระบุ from และ to พร้อมกัน หรือไม่ระบุทั้งคู่",
        },
        { status: 400 },
      );
    }

    let dateFilter = {};

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return Response.json(
          { message: "รูปแบบวันที่ไม่ถูกต้อง" },
          { status: 400 },
        );
      }

      if (fromDate >= toDate) {
        return Response.json(
          { message: "from ต้องอยู่ก่อน to" },
          { status: 400 },
        );
      }

      // รายการจองทับซ้อนเมื่อเริ่มก่อน to
      // และสิ้นสุดหลัง from
      dateFilter = {
        startTime: { lt: toDate },
        endTime: { gt: fromDate },
      };
    }

    const bookings = await prisma.booking.findMany({
      where: {
        roomId,
        ...dateFilter,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return Response.json(bookings, { status: 200 });
  } catch (error) {
    console.error("Failed to get room bookings:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการดึงรายการจอง" },
      { status: 500 },
    );
  }
}
