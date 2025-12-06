#!/usr/bin/env node

/**
 * Gussy Printer Server
 * ESC/POS Network Printer
 * Text-only (no image)
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const escpos = require("escpos");
escpos.Network = require("escpos-network");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= CONFIG =================
const CONFIG_PATH = path.join(process.cwd(), "config.json");

if (!fs.existsSync(CONFIG_PATH)) {
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify(
      { printer_ip: "192.168.1.70", port: 4005 },
      null,
      2
    )
  );
}

let config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ================= UTILS =================
function formatRupiah(amount) {
  return `Rp ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function openPrinter() {
  const device = new escpos.Network(config.printer_ip);
  const printer = new escpos.Printer(device);
  return { device, printer };
}

// ================= ROUTES =================

// --- SETTINGS UI ---
app.get("/settings", (_, res) => {
  res.send(`
    <html>
      <body style="font-family:Arial;max-width:420px;margin:40px auto">
        <h2>Gussy Printer Settings</h2>

        <form method="POST" action="/set-printer-ip">
          <label>Printer IP</label><br/>
          <input name="ip" value="${config.printer_ip}"
            style="width:100%;padding:8px"/><br/><br/>
          <button>Save</button>
        </form>

        <br/>

        <form method="POST" action="/test-print">
          <button>Test Print</button>
        </form>
      </body>
    </html>
  `);
});

// --- UPDATE IP ---
app.post("/set-printer-ip", (req, res) => {
  if (!req.body.ip) return res.status(400).send("Missing IP");
  config.printer_ip = req.body.ip;
  saveConfig();
  res.send(`<p>Saved. <a href="/settings">Back</a></p>`);
});

// --- TEST PRINT ---
app.post("/test-print", (_, res) => {
  const { device, printer } = openPrinter();

  device.open(() => {
    printer
      .font("b")
      .size(1, 1)
      .align("ct")
      .style("b")
      .text("GUSSY SALON")
      .style("normal")
      .text("Printer connection OK")
      .feed(2)
      .cut()
      .close();

    res.send(`<p>Printed. <a href="/settings">Back</a></p>`);
  });
});

// --- PRINT SALE ---
app.post("/print-sale", (req, res) => {
  const sale = req.body.sale;
  if (!sale) return res.status(400).json({ error: "Missing sale data" });

  const { device, printer } = openPrinter();

  device.open(() => {
    printer.font("b").size(1, 1);

    printer.align("ct");
    printer.style("b");
    printer.text("GUSSY SALON");
    printer.style("normal");
    printer.text("Jl Tentara Pelajar No 11 Purwokerto");
    printer.text("Telp: +62 877 7707 9820");
    printer.text("--------------------------------");

    printer.align("lt");
    printer.style("normal");
    printer.text(`ID      : ${sale.id}`);
    printer.text(`Cust    : ${sale.client_name}`);
    printer.text(`Kapster : ${sale.staff?.fullname || "-"}`);
    printer.text("--------------------------------");

    sale.items.forEach((item) => {
      printer.text(item.name);
      printer.text(`x1   ${formatRupiah(item.price)}`);
    });

    printer.text("--------------------------------");

    if (sale.points_used > 0) {
      printer.text(`Point: -${formatRupiah(sale.points_used)}`);
    }

    if (sale.discount > 0) {
      printer.text(`Diskon: -${formatRupiah(sale.discount)}`);
    }

    printer.style("b");
    printer.text(`TOTAL: ${formatRupiah(sale.total_amount)}`);
    printer.style("normal");

    printer.text("--------------------------------");

    printer.feed(1);
    printer.align("ct");
    printer.text("Terima kasih");
    printer.text("Join member di gussysalon.com");
    printer.cut();
    printer.close();

    res.json({ success: true });
  });
});

// ================= START =================
app.listen(config.port, () => {
  console.log("=================================");
  console.log(" Gussy Printer Server RUNNING");
  console.log(" Port      :", config.port);
  console.log(" Printer IP:", config.printer_ip);
  console.log("=================================");
});
