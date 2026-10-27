import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: ดูรายละเอียดรายการจองตาม ID
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const bookingId = Number(id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return Response.json(
        { message: "ID รายการจองไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true },
    });

    if (!booking) {
      return Response.json({ message: "ไม่พบรายการจอง" }, { status: 404 });
    }

    return Response.json(booking, { status: 200 });
  } catch (error) {
    console.error("Failed to get booking:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการดึงรายการจอง" },
      { status: 500 },
    );
  }
}

// PATCH: แก้ไขรายการจองก่อนเวลาเริ่มจอง
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const bookingId = Number(id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return Response.json(
        { message: "ID รายการจองไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { message: "รูปแบบข้อมูลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!existing) {
      return Response.json({ message: "ไม่พบรายการจอง" }, { status: 404 });
    }

    if (existing.startTime <= new Date()) {
      return Response.json(
        { message: "ไม่สามารถแก้ไขรายการจองหลังเวลาเริ่มจองได้" },
        { status: 409 },
      );
    }

    const allowedFields = [
      "roomId",
      "bookerName",
      "purpose",
      "startTime",
      "endTime",
      "attendeeCount",
    ];

    if (!Object.keys(body).some((key) => allowedFields.includes(key))) {
      return Response.json(
        { message: "กรุณาระบุข้อมูลที่ต้องการแก้ไข" },
        { status: 400 },
      );
    }

    const data: {
      roomId?: number;
      bookerName?: string;
      purpose?: string;
      startTime?: Date;
      endTime?: Date;
      attendeeCount?: number;
    } = {};

    if (body.roomId !== undefined) {
      if (!Number.isInteger(body.roomId) || body.roomId <= 0) {
        return Response.json(
          { message: "roomId ต้องเป็นจำนวนเต็มมากกว่า 0" },
          { status: 400 },
        );
      }
      data.roomId = body.roomId;
    }

    if (body.bookerName !== undefined) {
      if (
        typeof body.bookerName !== "string" ||
        body.bookerName.trim() === ""
      ) {
        return Response.json(
          { message: "ชื่อผู้จองต้องไม่เป็นค่าว่าง" },
          { status: 400 },
        );
      }
      data.bookerName = body.bookerName.trim();
    }

    if (body.purpose !== undefined) {
      if (typeof body.purpose !== "string" || body.purpose.trim() === "") {
        return Response.json(
          { message: "วัตถุประสงค์ต้องไม่เป็นค่าว่าง" },
          { status: 400 },
        );
      }
      data.purpose = body.purpose.trim();
    }

    if (body.startTime !== undefined) {
      if (typeof body.startTime !== "string") {
        return Response.json(
          { message: "startTime ไม่ถูกต้อง" },
          { status: 400 },
        );
      }
      const date = new Date(body.startTime);
      if (Number.isNaN(date.getTime())) {
        return Response.json(
          { message: "รูปแบบ startTime ไม่ถูกต้อง" },
          { status: 400 },
        );
      }
      data.startTime = date;
    }

    if (body.endTime !== undefined) {
      if (typeof body.endTime !== "string") {
        return Response.json(
          { message: "endTime ไม่ถูกต้อง" },
          { status: 400 },
        );
      }
      const date = new Date(body.endTime);
      if (Number.isNaN(date.getTime())) {
        return Response.json(
          { message: "รูปแบบ endTime ไม่ถูกต้อง" },
          { status: 400 },
        );
      }
      data.endTime = date;
    }

    if (body.attendeeCount !== undefined) {
      if (!Number.isInteger(body.attendeeCount) || body.attendeeCount <= 0) {
        return Response.json(
          { message: "attendeeCount ต้องเป็นจำนวนเต็มมากกว่า 0" },
          { status: 400 },
        );
      }
      data.attendeeCount = body.attendeeCount;
    }

    const roomId = data.roomId ?? existing.roomId;
    const startTime = data.startTime ?? existing.startTime;
    const endTime = data.endTime ?? existing.endTime;
    const attendeeCount = data.attendeeCount ?? existing.attendeeCount;

    if (startTime <= new Date()) {
      return Response.json(
        { message: "เวลาเริ่มจองต้องอยู่ในอนาคต" },
        { status: 400 },
      );
    }

    if (startTime >= endTime) {
      return Response.json(
        { message: "เวลาเริ่มต้องอยู่ก่อนเวลาสิ้นสุด" },
        { status: 400 },
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return Response.json(
        { message: "ไม่พบห้องประชุมที่ระบุ" },
        { status: 404 },
      );
    }

    if (attendeeCount > room.capacity) {
      return Response.json(
        { message: "จำนวนผู้เข้าร่วมเกินความจุของห้อง" },
        { status: 400 },
      );
    }

    const overlap = await prisma.booking.findFirst({
      where: {
        id: { not: bookingId },
        roomId,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (overlap) {
      return Response.json(
        { message: "ช่วงเวลานี้มีรายการจองห้องแล้ว" },
        { status: 409 },
      );
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data,
      include: { room: true },
    });

    return Response.json(updated, { status: 200 });
  } catch (error) {
    console.error("Failed to update booking:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการแก้ไขรายการจอง" },
      { status: 500 },
    );
  }
}

// DELETE: ยกเลิกรายการจองก่อนเวลาเริ่มจอง
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const bookingId = Number(id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return Response.json(
        { message: "ID รายการจองไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return Response.json({ message: "ไม่พบรายการจอง" }, { status: 404 });
    }

    if (booking.startTime <= new Date()) {
      return Response.json(
        { message: "ไม่สามารถยกเลิกรายการจองหลังเวลาเริ่มจองได้" },
        { status: 409 },
      );
    }

    await prisma.booking.delete({
      where: { id: bookingId },
    });

    return Response.json({ message: "ยกเลิกรายการจองสำเร็จ" }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete booking:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการยกเลิกรายการจอง" },
      { status: 500 },
    );
  }
}
