import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import DashboardChart from "../components/DashboardChart";
import ExcelEditor from "../components/ExcelEditor";

function Home() {
  const fileInputRef = useRef(null);
  const dashboardRef = useRef(null);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [zColumn, setZColumn] = useState("");

  const [chartType, setChartType] = useState("bar");
  const [charts, setCharts] = useState([]);
  const [showExcelEditor, setShowExcelEditor] = useState(false);

  /* ================================
     FILE
  ================================= */

  const chooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setCharts([]);
    setError("");
  };

  /* ================================
     ANALYZE DATASET
  ================================= */

  const analyzeFile = async () => {
    if (!file) {
      setError("Please select a CSV or Excel file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setCharts([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "http://192.168.216.1:8000/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Dataset analysis failed."
        );
      }

      setResult(data);

      const allColumns =
        data.profile?.column_names || [];

      const numericColumns =
        data.columns?.numeric_columns || [];

      const textColumns =
        data.columns?.text_columns || [];

      if (textColumns.length > 0) {
        setXColumn(textColumns[0]);
      } else if (allColumns.length > 0) {
        setXColumn(allColumns[0]);
      }

      if (numericColumns.length > 0) {
        setYColumn(numericColumns[0]);
      }

      if (numericColumns.length > 1) {
        setZColumn(numericColumns[1]);
      }
    } catch (err) {
      console.error(err);

      setError(
        "Could not connect to FastAPI. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================================
     CREATE CHART DATA
  ================================= */

  const createChartData = () => {
    if (!result?.data?.length) return [];

    if (!xColumn || !yColumn) return [];

    const grouped = {};

    result.data.forEach((row) => {
      const xValue = row[xColumn];
      const yValue = Number(row[yColumn]);

      if (
        xValue === undefined ||
        xValue === null ||
        xValue === ""
      ) {
        return;
      }

      if (Number.isNaN(yValue)) return;

      const key = String(xValue);

      if (!grouped[key]) {
        grouped[key] = 0;
      }

      grouped[key] += yValue;
    });

    return Object.entries(grouped)
      .slice(0, 50)
      .map(([label, value]) => ({
        label,
        value,
      }));
  };

  /* ================================
     ADD CHART
  ================================= */

  const addChart = () => {
    if (!xColumn || !yColumn) {
      setError(
        "Please select both X-axis and Y-axis columns."
      );
      return;
    }

    const values = createChartData();

    if (!values.length) {
      setError(
        "Could not create a chart from these columns."
      );
      return;
    }

    setError("");

    const newChart = {
      id: Date.now(),
      xColumn,
      yColumn,
      zColumn,
      chartType,
      values,
      rawData: result.data,
      is3D: false,
    };

    setCharts((previous) => [
      ...previous,
      newChart,
    ]);
  };

  /* ================================
     UPDATE CHART
  ================================= */

  const updateChart = (id, changes) => {
    setCharts((previous) =>
      previous.map((chart) =>
        chart.id === id
          ? {
              ...chart,
              ...changes,
            }
          : chart
      )
    );
  };

  /* ================================
     REMOVE CHART
  ================================= */

  const removeChart = (id) => {
    setCharts((previous) =>
      previous.filter(
        (chart) => chart.id !== id
      )
    );
  };

  /* ================================
     NEW DATASET
  ================================= */

  const resetDashboard = () => {
    setFile(null);
    setResult(null);
    setCharts([]);
    setError("");

    setXColumn("");
    setYColumn("");
    setZColumn("");
    setChartType("bar");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* ================================
     DOWNLOAD CSV
  ================================= */

  const downloadCSV = () => {
    if (!result?.data?.length) return;

    const columns =
      result.profile?.column_names || [];

    const escapeCSV = (value) => {
      if (
        value === null ||
        value === undefined
      ) {
        return "";
      }

      const text = String(value);

      if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n")
      ) {
        return `"${text.replace(
          /"/g,
          '""'
        )}"`;
      }

      return text;
    };

    const csv = [
      columns
        .map(escapeCSV)
        .join(","),

      ...result.data.map((row) =>
        columns
          .map((column) =>
            escapeCSV(row[column])
          )
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "data-nytics-data.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* ================================
     EXPORT PNG
  ================================= */

  const exportPNG = async () => {
    if (!dashboardRef.current) {
      return;
    }

    try {
      setExporting(true);
      setError("");

      const canvas =
        await html2canvas(
          dashboardRef.current,
          {
            backgroundColor:
              "#05070c",
            scale: 2,
            useCORS: true,
            logging: false,
          }
        );

      const image =
        canvas.toDataURL(
          "image/png",
          1
        );

      const link =
        document.createElement("a");

      link.href = image;
      link.download =
        "data-nytics-dashboard.png";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);

      setError(
        "Could not export dashboard as PNG."
      );
    } finally {
      setExporting(false);
    }
  };

  /* ================================
     EXPORT PDF
  ================================= */

  const exportPDF = async () => {
    if (!dashboardRef.current) {
      return;
    }

    try {
      setExporting(true);
      setError("");

      const canvas =
        await html2canvas(
          dashboardRef.current,
          {
            backgroundColor:
              "#05070c",
            scale: 2,
            useCORS: true,
            logging: false,
          }
        );

      const image =
        canvas.toDataURL(
          "image/png",
          1
        );

      const pdf =
        new jsPDF({
          orientation:
            "portrait",
          unit: "mm",
          format: "a4",
        });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const margin = 8;

      const imageWidth =
        pageWidth -
        margin * 2;

      const imageHeight =
        (canvas.height *
          imageWidth) /
        canvas.width;

      let heightLeft =
        imageHeight;

      let position = margin;

      pdf.addImage(
        image,
        "PNG",
        margin,
        position,
        imageWidth,
        imageHeight
      );

      heightLeft -=
        pageHeight -
        margin * 2;

      while (heightLeft > 0) {
        position =
          heightLeft -
          imageHeight +
          margin;

        pdf.addPage();

        pdf.addImage(
          image,
          "PNG",
          margin,
          position,
          imageWidth,
          imageHeight
        );

        heightLeft -=
          pageHeight -
          margin * 2;
      }

      pdf.save(
        "data-nytics-dashboard.pdf"
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not export dashboard as PDF."
      );
    } finally {
      setExporting(false);
    }
  };

  /* ================================
     NOVA INSIGHTS
  ================================= */

  const generateNovaInsights = () => {
    if (!result?.data?.length) {
      return [];
    }

    const rows = result.data;
    const insights = [];

    const missingCount =
      Object.values(
        result.profile
          ?.missing_values || {}
      ).reduce(
        (total, value) =>
          total + Number(value),
        0
      );

    if (missingCount > 0) {
      insights.push({
        icon: "⚠️",
        title: "Data Quality",
        text:
          `${formatNumber(
            missingCount
          )} missing values detected.`,
      });
    } else {
      insights.push({
        icon: "✅",
        title: "Data Quality",
        text:
          "No missing values were detected.",
      });
    }

    const numericColumns =
      result.columns
        ?.numeric_columns || [];

    numericColumns
      .slice(0, 3)
      .forEach((column) => {
        const numbers = rows
          .map((row) =>
            Number(row[column])
          )
          .filter(
            (value) =>
              !Number.isNaN(value)
          );

        if (!numbers.length) {
          return;
        }

        const total =
          numbers.reduce(
            (sum, value) =>
              sum + value,
            0
          );

        const average =
          total / numbers.length;

        const maximum =
          Math.max(...numbers);

        const minimum =
          Math.min(...numbers);

        insights.push({
          icon: "📊",
          title:
            `${column} Overview`,
          text:
            `Average ${formatNumber(
              average
            )} · Max ${formatNumber(
              maximum
            )} · Min ${formatNumber(
              minimum
            )}`,
        });
      });

    insights.push({
      icon: "🔎",
      title: "Dataset Size",
      text:
        `${formatNumber(
          result.profile?.rows ||
            rows.length
        )} rows across ${
          result.profile?.columns ||
          0
        } columns.`,
    });

    return insights.slice(0, 6);
  };

  /* ================================
     DATA
  ================================= */

  const allColumns =
    result?.profile
      ?.column_names || [];

  const numericColumns =
    result?.columns
      ?.numeric_columns || [];

  const textColumns =
    result?.columns
      ?.text_columns || [];

  const dateColumns =
    result?.columns
      ?.date_columns || [];

  const missingValues =
    result?.profile
      ?.missing_values || {};

  const totalMissing =
    Object.values(
      missingValues
    ).reduce(
      (total, value) =>
        total + Number(value),
      0
    );

  return (
    <div style={styles.page}>
      <div style={styles.app}>

        {/* ==========================
            HEADER
        =========================== */}

        <header style={styles.header}>

          <div style={styles.brand}>

            <div style={styles.brandIcon}>
              ✦
            </div>

            <div>
              <div style={styles.brandName}>
                DATA-NYTICS
              </div>

              <div style={styles.brandTagline}>
                Intelligent Data Analytics
              </div>
            </div>

          </div>

          <div style={styles.novaStatus}>
            <span style={styles.statusDot} />
            Nova AI
          </div>

        </header>

        {/* ==========================
            UPLOAD PAGE
        =========================== */}

        {!result && (
          <section style={styles.hero}>

            <div style={styles.heroBadge}>
              ✦ SMART DATA ANALYSIS
            </div>

            <h1 style={styles.heroTitle}>
              Turn your data into
              <span style={styles.heroAccent}>
                {" "}insights.
              </span>
            </h1>

            <p style={styles.heroText}>
              Upload your CSV or Excel
              dataset and Nova will help
              you understand it through
              interactive visualizations.
            </p>

            <div style={styles.uploadCard}>

              <div style={styles.uploadIcon}>
                ↑
              </div>

              <h2 style={styles.uploadTitle}>
                Upload your dataset
              </h2>

              <p style={styles.uploadText}>
                CSV, XLSX or XLS
              </p>

              <button
                onClick={chooseFile}
                style={styles.chooseButton}
              >
                Choose File
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                style={{
                  display: "none",
                }}
              />

              {file && (
                <div style={styles.selectedFile}>

                  <span style={styles.fileIcon}>
                    📄
                  </span>

                  <div style={styles.fileInfo}>
                    <strong>
                      {file.name}
                    </strong>

                    <span>
                      Ready to analyze
                    </span>
                  </div>

                  <span style={styles.readyBadge}>
                    READY
                  </span>

                </div>
              )}

              {file && !loading && (
                <button
                  onClick={analyzeFile}
                  style={styles.analyzeButton}
                >
                  Analyze Dataset →
                </button>
              )}

              {loading && (
                <div style={styles.loadingBox}>

                  <div style={styles.spinner} />

                  <div>
                    <strong>
                      Nova is analyzing your data
                    </strong>

                    <span>
                      Detecting columns,
                      values and patterns...
                    </span>
                  </div>

                </div>
              )}

              {error && (
                <div style={styles.error}>
                  ❌ {error}
                </div>
              )}

            </div>

          </section>
        )}

        {/* ==========================
            DASHBOARD
        =========================== */}

        {result && (
          <>
            {showExcelEditor && (
              <ExcelEditor
                datasetId={result.dataset_id}
                initialData={result.data}
                onClose={() => setShowExcelEditor(false)}
                onSaved={(updated) => {
                  setResult((previous) => ({
                    ...previous,
                    ...updated,
                  }));

                  setCharts([]);
                  setShowExcelEditor(false);
                }}
              />
            )}

            <div ref={dashboardRef}>

            {/* DASHBOARD HEADER */}

            <section style={styles.dashboardHero}>

              <div>

                <div style={styles.smallLabel}>
                  DATASET ANALYSIS
                </div>

                <h1 style={styles.dashboardTitle}>
                  Your Data Dashboard
                </h1>

                <p style={styles.dashboardSubtitle}>
                  Nova analyzed{" "}
                  <strong>
                    {file?.name}
                  </strong>
                </p>

              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  onClick={() => setShowExcelEditor(true)}
                  style={styles.newDatasetButton}
                >
                  ✏️ Edit Data
                </button>

                <button
                  onClick={resetDashboard}
                  style={styles.newDatasetButton}
                >
                  + New Dataset
                </button>
              </div>

            </section>

            {/* EXPORT BAR */}

            <div
              style={styles.exportToolbar}
            >

              <div>

                <strong
                  style={
                    styles.exportTitle
                  }
                >
                  Dashboard Actions
                </strong>

                <span
                  style={
                    styles.exportSubtitle
                  }
                >
                  Export or download
                  your analysis
                </span>

              </div>

              <div
                style={
                  styles.exportButtons
                }
              >

                <button
                  onClick={downloadCSV}
                  disabled={exporting}
                  style={
                    styles.exportButton
                  }
                >
                  📥 Download Data
                </button>

                <button
                  onClick={exportPNG}
                  disabled={exporting}
                  style={
                    styles.exportButton
                  }
                >
                  📸 Export PNG
                </button>

                <button
                  onClick={exportPDF}
                  disabled={exporting}
                  style={
                    styles.exportPrimary
                  }
                >
                  📄{" "}
                  {exporting
                    ? "Exporting..."
                    : "Export PDF"}
                </button>

              </div>

            </div>

            {/* KPI CARDS */}

            <section style={styles.kpiGrid}>

              <KpiCard
                icon="▦"
                label="Total Rows"
                value={
                  result.profile.rows
                }
              />

              <KpiCard
                icon="◇"
                label="Columns"
                value={
                  result.profile.columns
                }
              />

              <KpiCard
                icon="◌"
                label="Missing Values"
                value={
                  totalMissing
                }
              />

              <KpiCard
                icon="⌁"
                label="Duplicate Rows"
                value={
                  result.profile
                    .duplicate_rows
                }
              />

            </section>

            {/* NOVA */}

            <section
              style={
                styles.novaInsightsCard
              }
            >

              <div
                style={
                  styles.novaInsightsHeader
                }
              >

                <div
                  style={
                    styles.novaBigIcon
                  }
                >
                  ✦
                </div>

                <div>

                  <div
                    style={
                      styles.cardEyebrow
                    }
                  >
                    NOVA AI
                  </div>

                  <h2
                    style={
                      styles.novaInsightsTitle
                    }
                  >
                    What Nova found
                  </h2>

                </div>

              </div>

              <div
                style={
                  styles.insightsGrid
                }
              >

                {generateNovaInsights().map(