import { useEffect, useMemo, useState } from "react";

// Helper for calling API endpoints.
const baseUrl = "/api";

// 新增一個安全的參數處理函式，確保 undefined 或 null 轉為空字串
function safe(v) {
  return v ?? "";
}

// 範例：計算段小段資料中的測量標記數量
function sumMarkerCount(sectItem) {
  return ["LM_N01", "LM_N02", "LM_N03", "LM_N04"]
    .map((k) => Number(sectItem?.[k] ?? 0))
    .reduce((a, b) => a + b, 0);
}

// 範例：從選項陣列中取得 KCDE_1 的對應文字標籤
function getKcde1Label(options, value) {
  const found = options.find((x) => x.KCDE_2 === value);
  return found?.KCNT ?? "";
}

async function callApi({ controller, action, params }) {
  const url = new URL(`${baseUrl}/${controller}/${action}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, v);
      }
    });
  }

  const res = await fetch(url.toString(), {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API 呼叫失敗: ${res.status} ${res.statusText} ${text}`);
  }

  return res.json();
}

function formatMinguoYear(year) {
  const y = parseInt(year, 10);
  if (Number.isNaN(y)) return "";
  return (y + 1911).toString();
}

function formatDateToMinguo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear() - 1911;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const d2 = String(d.getDate()).padStart(2, "0");
  return `${String(y).padStart(3, "0")}${m}${d2}`;
}

export default function Sur01Page() {
  const [year, setYear] = useState("115");
  const [kcde1, setKcde1] = useState("");
  const [kcde2, setKcde2] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fileFormat, setFileFormat] = useState("Excel");
  const [zi, setZi] = useState("");
  const [hao, setHao] = useState("");
  const [officeInfo, setOfficeInfo] = useState({ KCNT: "", KRMK: "" });

  const [kcde1Options, setKcde1Options] = useState([]);
  const [kcde2Options, setKcde2Options] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // 取得「收件字」選單
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const data = await callApi({
          controller: "Moiadm",
          action: "GetByKCDE_1",
          params: {
            kcde_1: "04",
          },
        });

        if (cancelled) return;
        setKcde1Options(Array.isArray(data?.ResultObject) ? data.ResultObject : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // 行政區選單
  useEffect(() => {
    let cancelled = false;

    async function loadAreaOptions() {
      try {
        setError(null);
        const data = await callApi({
          controller: "Moiadm",
          action: "GetByKcde_1",
          params: {
            kcde_1: "46",
          },
        });

        console.log("行政區 API 回傳 =", data);

        if (cancelled) return;
        setKcde2Options(Array.isArray(data?.ResultObject) ? data.ResultObject : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    loadAreaOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  // 地所資料
  useEffect(() => {
    let cancelled = false;

    async function loadOfficeInfo() {
      try {
        const data = await callApi({
          controller: "Moiadm",
          action: "GetByKcde_1Kcde_2",
          params: {
            kcde_1: "55",
            kcde_2: "01",
          },
        });

        const obj = data?.ResultObject;

        if (cancelled) return;

        if (Array.isArray(obj) && obj.length > 0) {
          setOfficeInfo({
            KCNT: obj[0]?.KCNT ?? "",
            KRMK: obj[0]?.KRMK ?? "",
          });
        } else if (obj && !Array.isArray(obj)) {
          setOfficeInfo({
            KCNT: obj?.KCNT ?? "",
            KRMK: obj?.KRMK ?? "",
          });
        } else {
          setOfficeInfo({
            KCNT: "",
            KRMK: "",
          });
        }
      } catch (err) {
        console.error("取得地所資料失敗", err);
        if (!cancelled) {
          setOfficeInfo({
            KCNT: "",
            KRMK: "",
          });
        }
      }
    }

    loadOfficeInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  const canQuery = useMemo(() => {
    return !!startDate && !!endDate;
  }, [startDate, endDate]);

  async function handleQuery(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!canQuery) {
      setError("請填寫收件日期起訖。");
      return;
    }

    setLoading(true);

    try {
      const resp = await callApi({
        controller: "SUR01",
        action: "Cmsms",
        params: {
          mm01: String(year).padStart(3, "0"),
          mm02: kcde1,
          mm03: hao,
          mm04_1s: formatDateToMinguo(startDate),
          mm04_1e: formatDateToMinguo(endDate),
          mm07: kcde2,
        },
      });

      const items = Array.isArray(resp?.ResultObject) ? resp.ResultObject : [];

      const rows = await Promise.all(
        items.map(async (item) => {
          let sectList = [];
          let firstSect = {};

          try {
            const sectResp = await callApi({
              controller: "Moined",
              action: "SECT_D/SECT_C",
              params: {
                aa48: item.MM08,
              },
            });

            sectList = Array.isArray(sectResp?.ResultObject)
              ? sectResp.ResultObject
              : [];

            firstSect = sectList[0] ?? {};
          } catch (innerErr) {
            console.warn("段小段資料查詢失敗", item.MM08, innerErr);
          }

          return {
            所別: safe(officeInfo.KCNT),
            年度: safe(item.MM01),
            收件字: safe(item.MM02Name || getKcde1Label(kcde1Options, item.MM02)),
            收件號: safe(item.MM03),
            收件日期: safe(item.MM04_1),
            結案日期: safe(item.MD05_1),
            測量員姓名: safe(item.UserName),
            申請事由: safe(item.MM06Name),
            辦理情形: safe(item.MM22Name),
            行政區代碼: safe(item.MM07),
            行政區: safe(item.MM07Name),
            段代碼: safe(item.MM08),
            代表地號: safe(item.MM09),
            筆數: safe(item.MM11),
            面積: safe(item.MM12),
            釘界界標數量: sumMarkerCount(firstSect),
            測量方法: safe(firstSect.SURVEY),
            測量類別: safe(firstSect.SURVEY_TP),
            成圖年: safe(firstSect.MAP_YEAR),
            成圖月: safe(firstSect.MAP_MONTH),
            座標系統: safe(firstSect.COORDINATE),
            圖幅數: sectList.length,
            比例尺: safe(firstSect.SCALE),
            地所代碼: safe(officeInfo.KRMK),
          };
        })
      );

      setResult(rows);

      if (fileFormat === "Excel") {
        // TODO: 使用 SheetJS 產生 Excel
      } else {
        // TODO: 使用適合的函式庫輸出 ODF
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card shadow-sm">
      <div
        className="card-header text-center d-flex align-items-center justify-content-center"
        style={{ backgroundColor: "#999999", color: "#ffffff" }}
      >
        <h1 className="h3">測量案件清冊</h1>
      </div>

      <div className="card-body">
        <form onSubmit={handleQuery} className="mb-4">
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">收件年字號</label>
              <div className="row g-2 align-items-end">
                <div className="col-auto" style={{ minWidth: "110px" }}>
                  <input
                    className="form-control"
                    value={year}
                    maxLength={3}
                    placeholder="年"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      setYear(v);
                    }}
                  />
                </div>

                <div className="col-auto" style={{ minWidth: "170px" }}>
                  <select
                    className="form-select"
                    value={kcde1}
                    onChange={(e) => setKcde1(e.target.value)}
                  >
                    <option value="">請選擇</option>
                    {kcde1Options.map((opt, index) => (
                      <option
                        key={`kcde1-${index}-${opt.KCDE_1 ?? ""}-${opt.KCDE_2 ?? ""}`}
                        value={opt.KCDE_2 ?? ""}
                      >
                        {`${opt.KCDE_2 ?? ""}-${opt.KCNT ?? ""}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-auto d-flex align-items-center" style={{ height: "38px" }}>
                  字
                </div>

                <div className="col-auto" style={{ minWidth: "110px" }}>
                  <input
                    className="form-control"
                    value={hao}
                    placeholder="號"
                    onChange={(e) => setHao(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onBlur={() => {
                      if (hao) {
                        setHao(hao.padStart(6, "0"));
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="col-md-6 col-lg-4">
              <label className="form-label">行政區</label>
              <select
                className="form-select"
                value={kcde2}
                onChange={(e) => setKcde2(e.target.value)}
                disabled={!kcde2Options?.length}
              >
                <option value="">請選擇</option>
                {kcde2Options.map((opt, index) => (
                  <option
                    key={`kcde2-${opt.KCDE_1 ?? ""}-${opt.KCDE_2 ?? index}`}
                    value={opt.KCDE_2 ?? ""}
                  >
                    {opt.KCNT ?? opt.KRMK ?? opt.KCDE_2 ?? ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label">收件日期起訖</label>
              <div className="row g-2 align-items-center">
                <div className="col">
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="col-auto text-center">～</div>
                <div className="col">
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="col-md-6 col-lg-4">
              <label className="form-label d-block">檔案格式</label>

              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="fileFormat"
                  id="formatExcel"
                  value="Excel"
                  checked={fileFormat === "Excel"}
                  onChange={(e) => setFileFormat(e.target.value)}
                />
                <label className="form-check-label" htmlFor="formatExcel">
                  Excel
                </label>
              </div>

              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="fileFormat"
                  id="formatOdf"
                  value="odf"
                  checked={fileFormat === "odf"}
                  onChange={(e) => setFileFormat(e.target.value)}
                />
                <label className="form-check-label" htmlFor="formatOdf">
                  odf
                </label>
              </div>
            </div>

            <div className="col-12 text-center">
              <button
                type="submit"
                className="btn btn-success px-4"
                disabled={loading}
              >
                {loading ? "列印中..." : "列印"}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="alert alert-danger" role="alert">
            <strong>發生錯誤：</strong> {error}
          </div>
        )}

        {result && (
          <div className="card p-4">
            <h2 className="h5">查詢結果</h2>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}