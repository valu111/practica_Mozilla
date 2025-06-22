const puppeteer = require("puppeteer");
const fs = require("fs");
const { Parser } = require("json2csv");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");

(async () => {
  const navegador = await puppeteer.launch({
    headless: false,
    slowMo: 80,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const pestaña = await navegador.newPage();
  const articulosExtraidos = [];
  const totalPaginas = 3;

  try {
    for (let numeroPagina = 1; numeroPagina <= totalPaginas; numeroPagina++) {
      const urlPagina = `https://hacks.mozilla.org/articles/page/${numeroPagina}/`;
      console.log(`🔎 Explorando página ${numeroPagina} de ${totalPaginas}`);

      await pestaña.goto(urlPagina, { waitUntil: "networkidle2", timeout: 0 });
      await pestaña.waitForSelector("ul.article-list li", { timeout: 30000 });

      const articulosPrevios = await pestaña.evaluate(() => {
        return Array.from(document.querySelectorAll("ul.article-list li")).map(
          (elemento) => {
            const enlaceTitulo = elemento.querySelector("h3.post__title a");
            const resumenElemento = elemento.querySelector("p.post__tease");
            return {
              titulo: enlaceTitulo?.innerText || "No ha encontrado un Titulo",
              resumen: resumenElemento?.innerText || "No se ha encontrado un resumen ",
              enlace: enlaceTitulo?.href || "",
            };
          }
        );
      });

      for (const articulo of articulosPrevios) {
        try {
          await pestaña.goto(articulo.enlace, {
            waitUntil: "networkidle2",
            timeout: 0,
          });
          await pestaña.waitForSelector("h1", { timeout: 30000 });

          const detalleArticulo = await pestaña.evaluate(() => {
            const autorElemento = document.querySelector(
              "div.outer-wrapper>div#content-head>div.byline>h3.post__author a"
            );
            const autor = autorElemento?.innerText || "No se encontro el autor";
            const fecha =
              document.querySelector("abbr.published")?.getAttribute("title") ||
              "No se ha encontrado una fecha";
            const primerParrafo =
              Array.from(document.querySelectorAll(".post-content p"))
                .find(
                  (p) =>
                    p.offsetParent !== null && p.innerText.trim().length > 30
                )
                ?.innerText.trim() || "No hay parrafo";
            const avatar =
              document.querySelector("img.avatar")?.getAttribute("src") ||
              "Imagen no encontrada";

            return { autor, fecha, avatar, primerParrafo };
          });

          articulosExtraidos.push({
            autor: detalleArticulo.autor,
            titulo: articulo.titulo,
            resumen: articulo.resumen,
            parrafo: detalleArticulo.primerParrafo,
            fecha: detalleArticulo.fecha,
            url: articulo.enlace,
            imagen: detalleArticulo.avatar,
          });

          console.log(`${articulo.titulo}`);
        } catch (err) {
          console.warn(`Falla en  el scraping de ${articulo.enlace}: ${err.message}`);
        }
      }
    }

    // Guardar JSON
    fs.writeFileSync(
      "articulos.json",
      JSON.stringify(articulosExtraidos, null, 2),
      "utf-8"
    );
    console.log('Archivo JSON generado');

    // Guardar CSV
    const parser = new Parser();
    const contenidoCSV = parser.parse(articulosExtraidos);
    fs.writeFileSync("articulos.csv", contenidoCSV, "utf-8");
    console.log('Archivo CSV generado');

    // Guardar Excel
    const hoja = XLSX.utils.json_to_sheet(articulosExtraidos);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Artículos");
    XLSX.writeFile(libro, "articulos.xlsx");
    console.log('Archivo Excel generado');

    // Guardar PDF
    const pdf = new PDFDocument();
    pdf.pipe(fs.createWriteStream("articulos.pdf"));
    pdf.fontSize(18).text("Artículos Mozilla Hacks", { align: "center" }).moveDown();

    articulosExtraidos.forEach((item, index) => {
      pdf
        .fontSize(14)
        pdf.fontSize(12).text(`${index + 1}. ${item.titulo}`, { underline: true }); 
        pdf.fontSize(10).text(`Autor: ${item.autor}`);
        pdf.text(`Fecha: ${item.fecha}`);
        pdf.text(`Resumen: ${item.resumen}`);
        pdf.text(`Primer párrafo: ${item.parrafo}`);
        pdf.text(`URL: ${item.url}`);
        pdf.moveDown();

    });

    pdf.end();
    console.log('Archivo PDF generado');

    // Guardar TXT
    let textoPlano = "Artículos Mozilla Hacks\n\n";
    articulosExtraidos.forEach((item, index) => {
      textoPlano += `${index + 1}. ${item.titulo}\n`;
      textoPlano += `Autor: ${item.autor}\n`;
      textoPlano += `Fecha: ${item.fecha}\n`;
      textoPlano += `Resumen: ${item.resumen}\n`;
      textoPlano += `Primer párrafo: ${item.parrafo}\n`;
      textoPlano += `URL: ${item.url}\n`;
      textoPlano += `\n-----------------------------\n\n`;

    });
    fs.writeFileSync("articulos.txt", textoPlano, "utf-8");
    console.log('Archivo TXT generado');

console.log(`\nEl Proceso ha finalizado con éxito. Artículos obtenidos: ${articulosExtraidos.length}`);
  } catch (error) {
    console.error("Error durante el proceso:", error);
  } finally {
    await navegador.close();
  }
})();