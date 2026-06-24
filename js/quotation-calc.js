// ===== QT CALC =====
// Calculation and table functions for QT / IN / RC
// Must stay in global scope — HTML calls these via onclick/onchange/oninput
// Do NOT add type="module" to the <script> tag that loads this file

let qtRowCount = 0;

function addQtRow(name, qty, price) {
    qtRowCount++;
    const tbody = document.getElementById('qtTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="col-no">
            <span class="qt-row-num">${tbody.children.length + 1}</span>
            <button type="button" class="qt-row-remove" data-no-capture="true" onclick="removeQtRow(this)" title="ลบแถว">✕</button>
        </td>
        <td class="col-name"><input type="text" class="qt-name" value="${name || ''}" oninput="saveQuotationForm()"></td>
        <td class="col-qty"><input type="text" class="text-center qt-qty" inputmode="decimal" value="${qty || ''}" oninput="updateQtTotals()"></td>
        <td class="col-price"><input type="text" class="text-right qt-price" inputmode="decimal" value="${price || ''}" oninput="updateQtTotals()"></td>
        <td class="col-total amount qt-total">0</td>
    `;
    // ทำให้ปุ่ม X อยู่มุมขวาบนของ cell ลำดับ
    const td = tr.querySelector('.col-no');
    td.style.position = 'relative';
    const btn = tr.querySelector('.qt-row-remove');
    btn.style.position = 'absolute';
    btn.style.top = '2px';
    btn.style.right = '2px';
    btn.style.fontSize = '14px';
    tbody.appendChild(tr);
    updateQtTotals();
}

function removeQtRow(btn) {
    const tr = btn.closest('tr');
    tr.remove();
    renumberQtRows();
    updateQtTotals();
    saveQuotationForm();
}

function renumberQtRows() {
    const rows = document.querySelectorAll('#qtTableBody tr');
    rows.forEach((tr, i) => {
        const numEl = tr.querySelector('.qt-row-num');
        if (numEl) numEl.textContent = i + 1;
    });
}

function parseNumber(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
}

function formatNumber(n) {
    if (n === 0) return '0';
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function updateQtTotals() {
    let subtotal = 0;
    const rows = document.querySelectorAll('#qtTableBody tr');
    rows.forEach(tr => {
        const qtyInput = tr.querySelector('.qt-qty');
        const priceInput = tr.querySelector('.qt-price');
        const qtyRaw = (qtyInput.value || '').trim();
        const price = parseNumber(priceInput.value);
        let qty;
        if (qtyRaw === '' && price > 0) {
            // มีราคาแต่ไม่ได้ใส่จำนวน → auto-fill qty = 1
            qtyInput.value = '1';
            qty = 1;
        } else {
            qty = parseNumber(qtyRaw);
        }
        const total = qty * price;
        tr.querySelector('.qt-total').textContent = formatNumber(total);
        subtotal += total;
    });
    const discount = parseNumber(document.getElementById('qtDiscount').value);
    const taxable = Math.max(0, subtotal - discount);
    const vatChecked = !!(document.getElementById('qtVatCheck') && document.getElementById('qtVatCheck').checked);
    const whtChecked = !!(document.getElementById('qtWhtCheck') && document.getElementById('qtWhtCheck').checked);
    const vatAmount = vatChecked ? Math.round(taxable * 0.07 * 100) / 100 : 0;
    const whtAmount = whtChecked ? Math.round(taxable * 0.03 * 100) / 100 : 0;
    const netPayable = taxable + vatAmount - whtAmount;

    document.getElementById('qtSubtotal').textContent = formatNumber(subtotal);
    document.getElementById('qtGrandTotal').textContent = formatNumber(taxable);
    document.getElementById('qtGrandTotalText').textContent = '(' + numberToThaiBaht(taxable) + ')';
    if (document.getElementById('qtVatAmount')) document.getElementById('qtVatAmount').textContent = formatNumber(vatAmount);
    if (document.getElementById('qtWhtAmount')) document.getElementById('qtWhtAmount').textContent = formatNumber(whtAmount);
    const netRow = document.getElementById('qtNetPayableRow');
    const netBahtRow = document.getElementById('qtNetPayableBahtRow');
    const showNet = vatChecked || whtChecked;
    if (netRow) {
        netRow.style.display = showNet ? 'flex' : 'none';
        if (document.getElementById('qtNetPayable')) document.getElementById('qtNetPayable').textContent = formatNumber(netPayable);
    }
    if (netBahtRow) {
        netBahtRow.style.display = showNet ? 'flex' : 'none';
        if (document.getElementById('qtNetPayableBahtText')) {
            document.getElementById('qtNetPayableBahtText').textContent = '(' + numberToThaiBaht(netPayable) + ')';
        }
    }
    updateQtBilling(netPayable);
    saveQuotationForm();
}

// ===== Billing Plan (ใบแจ้งหนี้): คำนวณยอดเรียกเก็บครั้งนี้ + ยอดคงเหลือ =====
function updateQtBilling(grandTotal) {
    const section = document.getElementById('qtBillingSection');
    if (!section || section.style.display === 'none') return;

    const typeSel = document.getElementById('qtBillingType');
    const amountInput = document.getElementById('qtBillingAmount');
    const remainingEl = document.getElementById('qtRemainingAmount');
    if (!typeSel || !amountInput || !remainingEl) return;

    const type = typeSel.value;
    let billing = 0;

    if (type === 'custom') {
        amountInput.readOnly = false;
        billing = parseNumber(amountInput.value);
    } else {
        amountInput.readOnly = true;
        if (type === 'deposit_50' || type === 'final_50') {
            billing = grandTotal * 0.5;
        } else {
            // full
            billing = grandTotal;
        }
        amountInput.value = formatNumber(billing);
    }

    const remaining = (type === 'final_50') ? 0 : Math.max(0, grandTotal - billing);
    remainingEl.textContent = formatNumber(remaining);
}

function computeNetPayable() {
    const taxable = parseNumber(document.getElementById('qtGrandTotal').textContent);
    const vatChecked = !!(document.getElementById('qtVatCheck') && document.getElementById('qtVatCheck').checked);
    const whtChecked = !!(document.getElementById('qtWhtCheck') && document.getElementById('qtWhtCheck').checked);
    const vatAmount = vatChecked ? Math.round(taxable * 0.07 * 100) / 100 : 0;
    const whtAmount = whtChecked ? Math.round(taxable * 0.03 * 100) / 100 : 0;
    return taxable + vatAmount - whtAmount;
}

function onQtBillingTypeChange() {
    updateQtBilling(computeNetPayable());
    saveQuotationForm();
}

function onQtBillingAmountInput() {
    updateQtBilling(computeNetPayable());
    saveQuotationForm();
}

// ===== แปลงเลขเป็นตัวอักษรไทย =====
function numberToThaiBaht(num) {
    if (num === 0 || isNaN(num)) return 'ศูนย์บาทถ้วน';
    const numStr = num.toFixed(2);
    const [bahtPart, satangPart] = numStr.split('.');
    const bahtText = readThaiNumber(parseInt(bahtPart, 10));
    const satang = parseInt(satangPart, 10);
    if (satang > 0) {
        return bahtText + 'บาท' + readThaiNumber(satang) + 'สตางค์';
    }
    return bahtText + 'บาทถ้วน';
}

function readThaiNumber(n) {
    if (n === 0) return 'ศูนย์';
    const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    const str = n.toString();
    let result = '';
    const len = str.length;
    for (let i = 0; i < len; i++) {
        const digit = parseInt(str[i], 10);
        const pos = len - i - 1;
        if (digit === 0) continue;
        // กรณีพิเศษ
        if (pos === 0 && digit === 1 && len > 1) {
            result += 'เอ็ด';
        } else if (pos === 1 && digit === 2) {
            result += 'ยี่' + positions[pos];
        } else if (pos === 1 && digit === 1) {
            result += positions[pos];
        } else {
            result += digits[digit] + positions[pos];
        }
    }
    return result;
}
