'use client';

import { formatCurrency, formatDate } from '@/lib/format';

export interface PrintItem {
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  subtotal: number;
  unit_name?: string;
  description?: string;
}

export interface PrintMetaField {
  label: string;
  value: string;
}

export interface PrintTemplateProps {
  docType: 'INVOICE' | 'QUOTATION' | 'SALES ORDER';
  docNumber: string;
  docDate: string;
  dueDate?: string;
  expiryDate?: string;
  status?: string;
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
  };
  customer: {
    name: string;
    code?: string;
    phone?: string;
    address?: string;
  };
  items: PrintItem[];
  subtotal: number;
  discountTotal?: number;
  totalAmount: number;
  amountPaid?: number;
  balanceDue?: number;
  notes?: string;
  payments?: { payment_number: string; payment_date: string; amount: number; payment_method: string }[];
  metaFields?: PrintMetaField[];
}

export default function PrintTemplate({
  docType,
  docNumber,
  docDate,
  dueDate,
  expiryDate,
  status,
  company,
  customer,
  items,
  subtotal,
  discountTotal = 0,
  totalAmount,
  amountPaid = 0,
  balanceDue = 0,
  notes,
  payments,
  metaFields,
}: PrintTemplateProps) {
  return (
    <div className="print-document" style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* ===== Title Bar ===== */}
      <div style={{ textAlign: 'center', borderBottom: '3px solid #111', paddingBottom: '10px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '2px', margin: 0, color: '#111' }}>{docType}</h1>
      </div>

      {/* ===== Company Header ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {company.logo_url && (
            <img src={company.logo_url} alt="logo" style={{ height: '52px', maxWidth: '52px', objectFit: 'contain' }} />
          )}
          <div>
            <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111' }}>{company.name || 'Your Company'}</p>
            {company.address && <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0 0', maxWidth: '280px', lineHeight: 1.5 }}>{company.address}</p>}
            <div style={{ display: 'flex', gap: '14px', marginTop: '3px' }}>
              {company.phone && <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>Tel: {company.phone}</p>}
              {company.email && <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{company.email}</p>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#111' }}>#{docNumber}</p>
          {status && (
            <p style={{ fontSize: '11px', fontWeight: 600, margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: '1px', color: status === 'Paid' || status === 'Accepted' ? '#16a34a' : status === 'Overdue' || status === 'Rejected' ? '#dc2626' : '#555' }}>{status}</p>
          )}
        </div>
      </div>

      {/* ===== Bill To + Document Details ===== */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
        {/* Bill To */}
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '6px', padding: '14px 16px' }}>
          <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#888', margin: '0 0 8px 0' }}>{docType === 'QUOTATION' ? 'Quotation For' : 'Bill To'}</p>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#111' }}>{customer.name}</p>
          {customer.code && <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0 0' }}>Code: {customer.code}</p>}
          {customer.phone && <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0 0' }}>Tel: {customer.phone}</p>}
          {customer.address && <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0 0', lineHeight: 1.5 }}>{customer.address}</p>}
        </div>

        {/* Document Details */}
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '6px', padding: '14px 16px' }}>
          <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#888', margin: '0 0 8px 0' }}>Details</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '11px', color: '#666' }}>{docType === 'QUOTATION' ? 'Issue Date' : 'Invoice Date'}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#111' }}>{formatDate(docDate)}</span>
          </div>
          {dueDate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>Due Date</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#111' }}>{formatDate(dueDate)}</span>
            </div>
          )}
          {expiryDate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>Valid Until</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#111' }}>{formatDate(expiryDate)}</span>
            </div>
          )}
          {metaFields?.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>{f.label}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#111' }}>{f.value}</span>
            </div>
          ))}
          {balanceDue !== undefined && docType !== 'QUOTATION' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>Balance Due</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: balanceDue > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(balanceDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== Items Table ===== */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #111' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444', borderRight: '1px solid #ddd' }}>SL No</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444', borderRight: '1px solid #ddd' }}>Item Code</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444', borderRight: '1px solid #ddd' }}>Item Details</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444', borderRight: '1px solid #ddd' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444', borderRight: '1px solid #ddd' }}>Rate</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444', borderRight: '1px solid #ddd' }}>Disc %</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#444' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: '#999', border: '1px solid #ddd' }}>No items</td></tr>
          ) : items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td style={{ padding: '8px 10px', fontSize: '11px', color: '#666', borderRight: '1px solid #eee' }}>{idx + 1}</td>
              <td style={{ padding: '8px 10px', fontSize: '11px', fontFamily: 'monospace', color: '#666', borderRight: '1px solid #eee' }}>{item.product_sku || '—'}</td>
              <td style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 500, color: '#111', borderRight: '1px solid #eee' }}>
                {item.product_name}
                {item.unit_name && <span style={{ display: 'block', fontSize: '10px', color: '#999' }}>{item.unit_name}</span>}
              </td>
              <td style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'right', color: '#111', borderRight: '1px solid #eee' }}>{item.quantity}{item.unit_name ? ` ${item.unit_name}` : ''}</td>
              <td style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'right', color: '#111', borderRight: '1px solid #eee' }}>{formatCurrency(item.unit_price)}</td>
              <td style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'right', color: '#666', borderRight: '1px solid #eee' }}>{(item.discount_percent || 0) > 0 ? `${item.discount_percent}%` : '—'}</td>
              <td style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'right', fontWeight: 600, color: '#111' }}>{formatCurrency(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== Totals + Remarks ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '20px' }}>
        {/* Left: Remarks */}
        <div style={{ flex: 1 }}>
          {notes && (
            <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '12px 14px' }}>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#888', margin: '0 0 6px 0' }}>Overall Remarks</p>
              <p style={{ fontSize: '11px', color: '#555', margin: 0, lineHeight: 1.6 }}>{notes}</p>
            </div>
          )}
          {payments && payments.length > 0 && (
            <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '12px 14px', marginTop: '10px' }}>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#888', margin: '0 0 6px 0' }}>Payments Received</p>
              {payments.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#666' }}>{p.payment_number} · {formatDate(p.payment_date)} · {p.payment_method?.replace('_', ' ')}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Totals */}
        <div style={{ width: '300px' }}>
          <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>Subtotal</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#111' }}>{formatCurrency(subtotal + discountTotal)}</span>
            </div>
            {discountTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                <span style={{ fontSize: '11px', color: '#666' }}>Discount</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626' }}>-{formatCurrency(discountTotal)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111', paddingTop: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>Total</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{formatCurrency(totalAmount)}</span>
            </div>
            {amountPaid > 0 && docType !== 'QUOTATION' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '7px' }}>
                  <span style={{ fontSize: '11px', color: '#666' }}>Amount Paid</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>-{formatCurrency(amountPaid)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '7px', marginTop: '7px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#111' }}>Balance Due</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: balanceDue > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(balanceDue)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== Footer ===== */}
      <div style={{ borderTop: '1px solid #ddd', paddingTop: '16px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ fontSize: '9px', color: '#999', margin: 0 }}>This is a computer-generated document and does not require a signature.</p>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#555', margin: '4px 0 0 0' }}>Thank you for your business!</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ borderTop: '1px solid #999', width: '140px', marginTop: '24px', paddingTop: '4px' }}>
              <p style={{ fontSize: '9px', color: '#999', margin: 0 }}>Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
