
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET: แสดงรายละเอียดห้องตาม ID
export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;
    const roomId = Number(id);

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return Response.json(
        { message: "ID ห้องไม่ถูกต้อง" },
        { status: 400 },
      );
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

    return Response.json(room, { status: 200 });
  } catch (error) {
    console.error("Failed to get room:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการดึงข้อมูลห้อง" },
      { status: 500 },
    );
  }
}

// PATCH: แก้ไขข้อมูลห้องตาม ID
export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;
    const roomId = Number(id);

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return Response.json(
        { message: "ID ห้องไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const body = await request.json();

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return Response.json(
        { message: "รูปแบบข้อมูลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // ตรวจสอบว่าห้องมีอยู่จริง
    const existingRoom = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!existingRoom) {
      return Response.json(
        { message: "ไม่พบข้อมูลห้องประชุม" },
        { status: 404 },
      );
    }

    // เตรียมเฉพาะฟิลด์ที่ผู้ใช้ส่งมา
    const data: {
      roomCode?: string;
      roomName?: string;
      capacity?: number;
      location?: string;
    } = {};

    if (body.roomCode !== undefined) {
      if (
        typeof body.roomCode !== "string" ||
        body.roomCode.trim() === ""
      ) {
        return Response.json(
          { message: "รหัสห้องต้องไม่เป็นค่าว่าง" },
          { status: 400 },
        );
      }

      data.roomCode = body.roomCode.trim();
    }

    if (body.roomName !== undefined) {
      if (
        typeof body.roomName !== "string" ||
        body.roomName.trim() === ""
      ) {
        return Response.json(
          { message: "ชื่อห้องต้องไม่เป็นค่าว่าง" },
          { status: 400 },
        );
      }

      data.roomName = body.roomName.trim();
    }

    if (body.location !== undefined) {
      if (
        typeof body.location !== "string" ||
        body.location.trim() === ""
      ) {
        return Response.json(
          { message: "สถานที่ต้องไม่เป็นค่าว่าง" },
          { status: 400 },
        );
      }

      data.location = body.location.trim();
    }

    if (body.capacity !== undefined) {
      if (
        !Number.isInteger(body.capacity) ||
        body.capacity <= 0
      ) {
        return Response.json(
          {
            message:
              "ความจุห้องต้องเป็นจำนวนเต็มมากกว่า 0",
          },
          { status: 400 },
        );
      }

      data.capacity = body.capacity;
    }

    // ต้องมีอย่างน้อยหนึ่งฟิลด์ที่ต้องการแก้ไข
    if (Object.keys(data).length === 0) {
      return Response.json(
        { message: "กรุณาระบุข้อมูลที่ต้องการแก้ไข" },
        { status: 400 },
      );
    }

    // ห้ามลดความจุต่ำกว่าจำนวนผู้เข้าร่วม
    // ของรายการจองที่ยังไม่สิ้นสุด
    if (data.capacity !== undefined) {
      const conflictingBooking =
        await prisma.booking.findFirst({
          where: {
            roomId,
            endTime: {
              gt: new Date(),
            },
            attendeeCount: {
              gt: data.capacity,
            },
          },
        });

      if (conflictingBooking) {
        return Response.json(
          {
            message:
              "ไม่สามารถลดความจุได้ เพราะมีรายการจองที่ต้องรองรับผู้เข้าร่วมมากกว่าความจุใหม่",
          },
          { status: 409 },
        );
      }
    }

    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data,
    });

    return Response.json(updatedRoom, { status: 200 });
  } catch (error) {
    // P2002 = รหัสห้องซ้ำ
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Response.json(
        { message: "รหัสห้องนี้มีอยู่ในระบบแล้ว" },
        { status: 409 },
      );
    }

    // P2025 = ไม่พบข้อมูลสำหรับแก้ไข
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return Response.json(
        { message: "ไม่พบข้อมูลห้องประชุม" },
        { status: 404 },
      );
    }

    console.error("Failed to update room:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการแก้ไขข้อมูลห้อง" },
      { status: 500 },
    );
  }
}

// DELETE: ลบห้องตาม ID
export async function DELETE(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const { id } = await params;
    const roomId = Number(id);

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return Response.json(
        { message: "ID ห้องไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // ตรวจสอบว่าห้องมีอยู่จริง
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return Response.json(
        { message: "ไม่พบข้อมูลห้องประชุม" },
        { status: 404 },
      );
    }

    // ห้ามลบห้องที่มีรายการจองอยู่ แม้รายการจองจะผ่านไปแล้ว
    const bookingCount = await prisma.booking.count({
      where: { roomId },
    });

    if (bookingCount > 0) {
      return Response.json(
        {
          message:
            "ไม่สามารถลบห้องได้ เนื่องจากยังมีรายการจองที่เกี่ยวข้อง",
        },
        { status: 409 },
      );
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    return Response.json(
      { message: "ลบข้อมูลห้องประชุมสำเร็จ" },
      { status: 200 },
    );
  } catch (error) {
    // ป้องกันกรณีมีรายการจองเพิ่มเข้ามาก่อนลบ
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return Response.json(
        {
          message:
            "ไม่สามารถลบห้องได้ เนื่องจากมีรายการจองที่เกี่ยวข้อง",
        },
        { status: 409 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return Response.json(
        { message: "ไม่พบข้อมูลห้องประชุม" },
        { status: 404 },
      );
    }

    console.error("Failed to delete room:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการลบข้อมูลห้อง" },
      { status: 500 },
    );
  }
}
