import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích tài chính hàng đầu, viết bài nhận định thị trường chuyên nghiệp bằng tiếng Việt.

Yêu cầu:
- Viết bài nhận định ngắn gọn 200-300 từ, súc tích, chuyên nghiệp
- Sử dụng ngôn ngữ tự tin, có góc nhìn rõ ràng
- Cấu trúc: Tổng quan → Phân tích kỹ thuật → Kịch bản giao dịch → Lưu ý
- Đề cập cụ thể các mức giá hỗ trợ, kháng cự, entry, TP, SL nếu có
- Phân tích mối tương quan BTC-Gold-DXY nếu có dữ liệu
- Kết luận bằng khuyến nghị hành động rõ ràng
- KHÔNG dùng markdown heading (#), chỉ dùng text thuần với emoji phù hợp
- Chia đoạn rõ ràng bằng xuống dòng`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { btc, gold, dxy } = await req.json();

    const userPrompt = `Dữ liệu thị trường hiện tại:

BTC/USDT:
- Giá: $${btc?.price ?? "N/A"}
- Xu hướng: ${btc?.trend ?? "N/A"}
- Hỗ trợ: $${btc?.support ?? "N/A"} | Kháng cự: $${btc?.resistance ?? "N/A"}
- Entry: $${btc?.entry ?? "N/A"} | TP: $${btc?.target ?? "N/A"} | SL: $${btc?.stopLoss ?? "N/A"}
- Timeframe: ${btc?.timeframe ?? "H4"}

XAU/USD (Vàng):
- Giá: $${gold?.price ?? "N/A"}
- Xu hướng: ${gold?.trend ?? "N/A"}
- Hỗ trợ: $${gold?.support ?? "N/A"} | Kháng cự: $${gold?.resistance ?? "N/A"}
- Entry: $${gold?.entry ?? "N/A"} | TP: $${gold?.target ?? "N/A"} | SL: $${gold?.stopLoss ?? "N/A"}
- Timeframe: ${gold?.timeframe ?? "H4"}

DXY (Chỉ số USD):
- Giá trị: ${dxy?.value ?? "N/A"}
- Thay đổi: ${dxy?.changePercent ?? "N/A"}%

Hãy viết bài nhận định thị trường dựa trên dữ liệu trên.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: response.status === 429 ? "Rate limited" : "AI error" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({ commentary: content, generated_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("market-commentary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
