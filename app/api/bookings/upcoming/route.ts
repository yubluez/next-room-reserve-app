import prisma from "@/lib/prisma";

// GET: แสดงรายการจองที่กำลังจะมาถึง
// ตัวอย่าง: /api/bookings/upcoming?days=7&roomId=1
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // days มีค่าเริ่มต้นเป็น 7 วัน
    const daysParam = searchParams.get("days");
    const days = daysParam === null ? 7 : Number(daysParam);

    if (!Number.isInteger(days) || days < 1 || days > 30) {
      return Response.json(
        { message: "days ต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 30" },
        { status: 400 },
      );
    }

    // ตรวจสอบ roomId ถ้ามีการส่งมา
    const roomIdParam = searchParams.get("roomId");
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

    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        startTime: {
          gte: now,
          lte: futureDate,
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

    return Response.json(
      {
        days,
        count: bookings.length,
        data: bookings,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to get upcoming bookings:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการดึงรายการจองที่กำลังจะมาถึง" },
      { status: 500 },
    );
  }
}
