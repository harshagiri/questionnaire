type PostOfficeRecord = {
  Name?: string;
  District?: string;
  State?: string;
  Country?: string;
};

type PostalApiResponse = {
  Status?: string;
  Message?: string;
  PostOffice?: PostOfficeRecord[] | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params;
  if (!/^\d{6}$/.test(pin)) {
    return Response.json({ ok: false, message: "Enter a valid six-digit PIN code." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) {
      return Response.json({ ok: false, message: "PIN lookup is temporarily unavailable." }, { status: 502 });
    }

    const payload = (await response.json()) as PostalApiResponse[];
    const result = payload[0];
    const postOffices = result?.PostOffice ?? [];
    if (result?.Status !== "Success" || postOffices.length === 0) {
      return Response.json({ ok: false, message: "PIN code not found. Enter your city manually." }, { status: 404 });
    }

    const first = postOffices[0];
    const localities = [...new Set(postOffices.map((office) => office.Name?.trim()).filter((name): name is string => Boolean(name)))].sort();
    return Response.json({
      ok: true,
      pin,
      district: first.District?.trim() ?? "",
      state: first.State?.trim() ?? "",
      country: first.Country?.trim() ?? "India",
      localities,
    });
  } catch {
    return Response.json({ ok: false, message: "PIN lookup is temporarily unavailable. Enter your city manually." }, { status: 502 });
  }
}