import ExcelJS from 'exceljs';

const RATING_LABELS = ['', 'Very poor', 'Poor', 'Neutral', 'Good', 'Excellent'];
const XLSX_COLUMNS = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Feedback Type', key: 'feedbackType', width: 20 },
  { header: 'Rating', key: 'rating', width: 12 },
  { header: 'Rating Label', key: 'ratingLabel', width: 16 },
  { header: 'Message', key: 'message', width: 60 },
  { header: 'Submitted At (UTC)', key: 'createdAt', width: 24 },
];

function protectCellValue(value) {
  const text = String(value ?? '');
  return /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)
    ? `'${text}`
    : text;
}

/** Create a styled XLSX workbook containing the supplied feedback rows. */
export async function serializeFeedbackXlsx(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Feedback Collector';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Feedback');
  worksheet.columns = XLSX_COLUMNS;
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: 'H1' };

  const header = worksheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '5426A8' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  for (const row of rows) {
    const worksheetRow = worksheet.addRow({
      id: row.id,
      name: protectCellValue(row.name),
      email: protectCellValue(row.email),
      feedbackType: protectCellValue(row.feedbackType),
      rating: row.rating,
      ratingLabel: RATING_LABELS[Number(row.rating)] ?? '',
      message: protectCellValue(row.message),
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    });
    worksheetRow.getCell('createdAt').numFmt = 'yyyy-mm-dd hh:mm:ss "UTC"';
    worksheetRow.getCell('message').alignment = { wrapText: true, vertical: 'top' };
    worksheetRow.getCell('createdAt').alignment = { vertical: 'top' };
  }

  return workbook.xlsx.writeBuffer();
}
