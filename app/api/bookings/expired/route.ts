import prisma from "@/lib/prisma";

// DELETE: ลบรายการจองเก่าของห้องที่ระบุ
// ตัวอย่าง: /api/bookings/expired?roomId=1&before=2026-10-28T00:00:00Z
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const roomIdParam = searchParams.get("roomId");
    const beforeParam = searchParams.get("before");

    // ต้องระบุ roomId และ before
    if (!roomIdParam || !beforeParam) {
      return Response.json(
        { message: "กรุณาระบุ roomId และ before" },
        { status: 400 },
      );
    }

    const roomId = Number(roomIdParam);

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return Response.json(
        { message: "roomId ต้องเป็นจำนวนเต็มมากกว่า 0" },
        { status: 400 },
      );
    }

    const before = new Date(beforeParam);

    if (Number.isNaN(before.getTime())) {
      return Response.json(
        { message: "รูปแบบวันที่ before ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // ห้ามใช้เวลาในอนาคต
    if (before > new Date()) {
      return Response.json(
        { message: "before ต้องไม่เป็นเวลาในอนาคต" },
        { status: 400 },
      );
    }

    // ตรวจสอบว่าห้องมีอยู่จริง
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        roomCode: true,
        roomName: true,
      },
    });

    if (!room) {
      return Response.json(
        { message: "ไม่พบข้อมูลห้องประชุม" },
        { status: 404 },
      );
    }

    // ลบเฉพาะรายการที่สิ้นสุดก่อนเวลาที่กำหนด
    const result = await prisma.booking.deleteMany({
      where: {
        roomId,
        endTime: {
          lt: before,
        },
      },
    });

    return Response.json(
      {
        message: "ลบรายการจองที่สิ้นสุดแล้วสำเร็จ",
        room,
        before: before.toISOString(),
        deletedCount: result.count,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to delete expired bookings:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการลบรายการจองเก่า" },
      { status: 500 },
    );
  }
}
