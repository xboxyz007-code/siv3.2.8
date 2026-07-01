'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import {
  Plus, ChevronDown, ChevronRight, FileText, Receipt, CreditCard,
  Package, ArrowRightLeft, ShoppingBag, X, Trash2, Lightbulb,
  Banknote, Building2, Zap, Truck, Users, RotateCcw,
} from 'lucide-react';
import type { Account } from '@/lib/types';

interface JournalLine {
  id: string;
  account_id: string;
  account: { code: string; name: string; account_type: string } | { code: string; name: string; account_type: string }[];
  description: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  created_at: string;
  lines?: JournalLine[];
}

const refIcons: Record<string, React.ElementType> = {
  invoice: Receipt,
  payment: CreditCard,
  grn: Package,
  sales_return: ArrowRightLeft,
  purchase_return: ShoppingBag,
  manual: FileText,
  opening_balance: Building2,
};

const refLabels: Record<string, string> = {
  invoice: 'Invoice',
  payment: 'Payment',
  grn: 'Goods Receipt',
  sales_return: 'Sales Return',
  purchase_return: 'Purchase Return',
  manual: 'Manual Entry',
  opening_balance: 'Opening Balance',
};

const refColors: Record<string, string> = {
  invoice: 'bg-blue-50 text-blue-600',
  payment: 'bg-green-50 text-green-600',
  grn: 'bg-orange-50 text-orange-600',
  sales_return: 'bg-red-50 text-red-600',
  purchase_return: 'bg-amber-50 text-amber-600',
  manual: 'bg-gray-50 text-gray-600',
  opening_balance: 'bg-purple-50 text-purple-600',
};

// Plain-English templates for non-accountants
interface JournalTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  lines: { accountCode: string; accountName: string; role: 'debit' | 'credit'; label: string }[];
  helpText: string;
}

const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'rent',
    name: 'Rent Payment',
    description: 'Monthly office or shop rent paid',
    icon: Building2,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    lines: [
      { accountCode: '5200', accountName: 'Rent Expense', role: 'debit', label: 'Rent paid (expense increases)' },
      { accountCode: '1001', accountName: 'Cash in Hand', role: 'credit', label: 'Cash paid out' },
    ],
    helpText: 'Use this when you pay rent. It records the expense and reduces your cash.',
  },
  {
    id: 'salary',
    name: 'Salary Payment',
    description: 'Staff or employee salary paid',
    icon: Users,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    lines: [
      { accountCode: '5100', accountName: 'Salaries & Wages', role: 'debit', label: 'Salary expense' },
      { accountCode: '1001', accountName: 'Cash in Hand', role: 'credit', label: 'Cash paid out' },
    ],
    helpText: 'Use this when paying staff. If paying by bank transfer, change the credit account to your bank account.',
  },
  {
    id: 'utility',
    name: 'Utility Bill',
    description: 'Electricity, water, or internet bill',
    icon: Zap,
    color: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    lines: [
      { accountCode: '5300', accountName: 'Utilities', role: 'debit', label: 'Utility expense' },
      { accountCode: '1001', accountName: 'Cash in Hand', role: 'credit', label: 'Cash paid out' },
    ],
    helpText: 'For electricity, water, gas, internet bills. Records the cost and the cash you paid.',
  },
  {
    id: 'bank_deposit',
    name: 'Bank Deposit',
    description: 'Deposit cash into the bank',
    icon: Banknote,
    color: 'bg-teal-50 text-teal-600 border-teal-200',
    lines: [
      { accountCode: '1002', accountName: 'Dhaka Bank Current A/C', role: 'debit', label: 'Bank balance increases' },
      { accountCode: '1001', accountName: 'Cash in Hand', role: 'credit', label: 'Cash on hand decreases' },
    ],
    helpText: 'Use when you move cash from the office into the bank. Both sides belong to you — you\'re just moving money.',
  },
  {
    id: 'bank_withdrawal',
    name: 'Bank Withdrawal',
    description: 'Withdraw cash from bank for use',
    icon: Banknote,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    lines: [
      { accountCode: '1001', accountName: 'Cash in Hand', role: 'debit', label: 'Cash on hand increases' },
      { accountCode: '1002', accountName: 'Dhaka Bank Current A/C', role: 'credit', label: 'Bank balance decreases' },
    ],
    helpText: 'Use when you take cash out of the bank for office use.',
  },
  {
    id: 'transport',
    name: 'Transport / Delivery Cost',
    description: 'Delivery or freight charges paid',
    icon: Truck,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    lines: [
      { accountCode: '5500', accountName: 'Transport & Delivery', role: 'debit', label: 'Transport expense' },
      { accountCode: '1001', accountName: 'Cash in Hand', role: 'credit', label: 'Cash paid out' },
    ],
    helpText: 'For delivery charges, freight, courier costs. Records it as a transport expense.',
  },
  {
    id: 'marketing',
    name: 'Marketing / Advertising',
    description: 'Online ads, print, or promotional costs',
    icon: Zap,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
    lines: [
      { accountCode: '5400', accountName: 'Marketing & Advertising', role: 'debit', label: 'Marketing expense' },
      { accountCode: '1001', accountName: 'Cash in Hand', role: 'credit', label: 'Cash paid out' },
    ],
    helpText: 'For Facebook/Google ads, banners, leaflets, or any promotional spending.',
  },
  {
    id: 'owner_withdrawal',
    name: 'Owner Withdrawal',
    description: 'Owner takes money out of the business',
    icon: RotateCcw,
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    lines: [
      { accountCode: '3000', accountName: 'Owner Equity', role: 'debit', label: 'Equity reduces' },
      { accountCode: '1001', accountName: 'Cash in Hand', role: 'credit', label: 'Cash taken out' },
    ],
    helpText: 'When the owner takes money out personally. This is not a salary — it reduces the owner\'s equity stake.',
  },
];

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [entriesRes, accountsRes] = await Promise.all([
      supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(150),
      supabase.from('accounts').select('*').eq('is_active', true).order('code'),
    ]);
    setEntries(entriesRes.data || []);
    setAccounts(accountsRes.data || []);
    setLoading(false);
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    const entry = entries.find(e => e.id === id);
    if (!entry?.lines) {
      const { data: lines } = await supabase
        .from('journal_lines')
        .select('id, account_id, description, debit, credit, account:accounts(code, name, account_type)')
        .eq('journal_entry_id', id)
        .order('sort_order');
      setEntries(prev => prev.map(e => e.id === id ? { ...e, lines: lines || [] } : e));
    }
    setExpandedId(id);
  }

  const filtered = filterType ? entries.filter(e => e.reference_type === filterType) : entries;
  const autoCount = entries.filter(e => e.reference_type !== 'manual').length;
  const manualCount = entries.filter(e => e.reference_type === 'manual').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Sales, purchases and payments are posted automatically</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" />Record Expense / Entry
        </button>
      </div>

      {/* Explanation banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 space-y-1">
          <p className="font-medium">How this works</p>
          <p className="text-blue-600 text-xs leading-relaxed">
            Whenever you confirm an invoice, record a payment, or receive goods — the accounting entries are created <strong>automatically</strong>.
            Use <strong>&quot;Record Expense / Entry&quot;</strong> only for things like rent, salaries, utility bills, or moving money between accounts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Total Entries</p>
          <p className="text-xl font-bold text-foreground">{entries.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Auto-Posted</p>
          <p className="text-xl font-bold text-green-600">{autoCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Manual Entries</p>
          <p className="text-xl font-bold text-blue-600">{manualCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Total Posted</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(entries.reduce((s, e) => s + Number(e.total_debit), 0))}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-border p-3 shadow-sm flex flex-wrap gap-2">
        {[
          { value: '', label: 'All Entries' },
          { value: 'invoice', label: 'Invoices' },
          { value: 'payment', label: 'Payments' },
          { value: 'grn', label: 'Goods Receipt' },
          { value: 'manual', label: 'Manual' },
          { value: 'opening_balance', label: 'Opening' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterType(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterType === f.value ? 'bg-blue-600 text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} entries</span>
      </div>

      <div className="table-wrapper">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="w-8"></th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Entry #</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Date</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Description</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Type</th>
              <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Amount</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="font-medium">No entries yet</p>
                  <p className="text-xs mt-1">Confirm an invoice or record a payment to see automatic entries here</p>
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <JournalEntryRow
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedId === entry.id}
                  onToggle={() => toggleExpand(entry.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <JournalEntryModal
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onSaved={() => { loadData(); setShowModal(false); }}
        />
      )}
    </div>
  );
}

function JournalEntryRow({ entry, isExpanded, onToggle }: { entry: JournalEntry; isExpanded: boolean; onToggle: () => void }) {
  const [lines, setLines] = useState<JournalLine[] | null>(null);
  const refType = entry.reference_type || 'manual';
  const Icon = refIcons[refType] || FileText;
  const colorClass = refColors[refType] || 'bg-gray-50 text-gray-600';

  useEffect(() => {
    if (isExpanded && !lines && entry.lines) setLines(entry.lines);
    else if (isExpanded && !lines) {
      supabase
        .from('journal_lines')
        .select('id, account_id, description, debit, credit, account:accounts(code, name, account_type)')
        .eq('journal_entry_id', entry.id)
        .order('sort_order')
        .then(({ data }) => setLines(data || []));
    }
  }, [isExpanded, entry.id, entry.lines, lines]);

  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-2 py-3">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </td>
        <td className="px-4 py-3 text-sm font-mono font-semibold text-blue-600">{entry.entry_number}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(entry.entry_date)}</td>
        <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">{entry.description}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${colorClass}`}>
            <Icon className="w-3 h-3" />
            {refLabels[refType] || refType}
          </span>
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">{formatCurrency(entry.total_debit)}</td>
        <td className="px-4 py-3">
          <span className={`badge-status ${entry.is_posted ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
            {entry.is_posted ? 'Posted' : 'Draft'}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50/80">
          <td colSpan={7} className="px-4 py-3">
            <div className="ml-6">
              {!lines ? (
                <div className="text-xs text-muted-foreground py-2">Loading lines...</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/60">
                      <th className="text-left py-1.5 font-medium w-48">Account</th>
                      <th className="text-left py-1.5 font-medium">Description</th>
                      <th className="text-right py-1.5 font-medium w-32">Debit</th>
                      <th className="text-right py-1.5 font-medium w-32">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const acc = Array.isArray(line.account) ? line.account[0] : line.account;
                      return (
                        <tr key={line.id} className="border-b border-border/30 last:border-0">
                          <td className="py-1.5">
                            <span className="font-mono text-muted-foreground mr-2 text-[10px]">{acc?.code}</span>
                            <span className="font-medium text-foreground">{acc?.name}</span>
                          </td>
                          <td className="py-1.5 text-muted-foreground">{line.description || '—'}</td>
                          <td className="py-1.5 text-right font-semibold text-green-700">{Number(line.debit) > 0 ? formatCurrency(line.debit) : '—'}</td>
                          <td className="py-1.5 text-right font-semibold text-red-600">{Number(line.credit) > 0 ? formatCurrency(line.credit) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="text-xs font-semibold border-t border-border">
                      <td colSpan={2} className="pt-2 text-muted-foreground">Total</td>
                      <td className="pt-2 text-right text-green-700">{formatCurrency(entry.total_debit)}</td>
                      <td className="pt-2 text-right text-red-600">{formatCurrency(entry.total_credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function JournalEntryModal({ accounts, onClose, onSaved }: { accounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'templates' | 'custom'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<JournalTemplate | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [lines, setLines] = useState<{ accountId: string; accountCode: string; debit: string; credit: string; description: string }[]>([
    { accountId: '', accountCode: '', debit: '', credit: '', description: '' },
    { accountId: '', accountCode: '', debit: '', credit: '', description: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function applyTemplate(tmpl: JournalTemplate) {
    setSelectedTemplate(tmpl);
    setDescription(tmpl.name);
    setAmount('');
  }

  function buildLinesFromTemplate(): { accountId: string; debit: number; credit: number; description: string }[] {
    if (!selectedTemplate || !amount) return [];
    const amt = parseFloat(amount) || 0;
    return selectedTemplate.lines.map(l => {
      const acc = accounts.find(a => a.code === l.accountCode);
      return {
        accountId: acc?.id || '',
        debit: l.role === 'debit' ? amt : 0,
        credit: l.role === 'credit' ? amt : 0,
        description: l.label,
      };
    });
  }

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  function addLine() {
    setLines([...lines, { accountId: '', accountCode: '', debit: '', credit: '', description: '' }]);
  }

  function removeLine(i: number) {
    if (lines.length > 2) setLines(lines.filter((_, j) => j !== i));
  }

  function updateLine(i: number, field: string, value: string) {
    const updated = [...lines];
    if (field === 'accountId') {
      const acc = accounts.find(a => a.id === value);
      updated[i] = { ...updated[i], accountId: value, accountCode: acc?.code || '' };
    } else {
      (updated[i] as any)[field] = value;
    }
    setLines(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    let finalLines: { accountId: string; debit: number; credit: number; description: string }[] = [];

    if (mode === 'templates' && selectedTemplate) {
      finalLines = buildLinesFromTemplate();
      if (finalLines.some(l => !l.accountId)) {
        setError('Some accounts from this template are not set up in your chart of accounts. Use the custom mode instead.');
        return;
      }
      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter an amount');
        return;
      }
    } else {
      const validLines = lines.filter(l => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
      if (validLines.length < 2) { setError('At least two line items are required'); return; }
      if (!isBalanced) { setError('Debits and credits must balance'); return; }
      if (totalDebit === 0) { setError('Entry must have a non-zero amount'); return; }
      finalLines = validLines.map(l => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description,
      }));
    }

    if (!description.trim()) { setError('Description is required'); return; }

    setSaving(true);
    try {
      const totalAmt = finalLines.reduce((s, l) => s + l.debit, 0);
      const entryNumber = `JE-${Date.now().toString().slice(-7)}`;

      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: entryDate,
          description,
          reference_type: 'manual',
          total_debit: totalAmt,
          total_credit: totalAmt,
          is_posted: true,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      for (let i = 0; i < finalLines.length; i++) {
        const line = finalLines[i];
        await supabase.from('journal_lines').insert({
          journal_entry_id: entry.id,
          account_id: line.accountId,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
          sort_order: i,
        });

        const account = accounts.find(a => a.id === line.accountId);
        if (account) {
          const change = (account.account_type === 'asset' || account.account_type === 'expense')
            ? line.debit - line.credit
            : line.credit - line.debit;
          await supabase.from('accounts').update({ balance: (account.balance || 0) + change }).eq('id', line.accountId);
        }
      }

      toast({ title: 'Success', description: `Entry ${entryNumber} posted` });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to create entry');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold">Record Expense / Entry</h2>
            <p className="text-xs text-muted-foreground mt-0.5">For rent, salaries, utilities, bank transfers and other manual items</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-border px-6">
          <button
            onClick={() => setMode('templates')}
            className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition ${mode === 'templates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Quick Templates
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`py-3 px-1 text-sm font-medium border-b-2 transition ${mode === 'custom' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Custom Entry
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          {mode === 'templates' ? (
            <>
              {/* Template grid */}
              {!selectedTemplate ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Select what you want to record:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {JOURNAL_TEMPLATES.map(tmpl => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => applyTemplate(tmpl)}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left hover:shadow-sm transition ${tmpl.color}`}
                      >
                        <div className="shrink-0 mt-0.5">
                          <tmpl.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{tmpl.name}</p>
                          <p className="text-[10px] opacity-70 mt-0.5">{tmpl.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`flex items-center gap-3 p-3 rounded-xl border-2 ${selectedTemplate.color}`}>
                    <selectedTemplate.icon className="w-5 h-5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{selectedTemplate.name}</p>
                      <p className="text-xs opacity-70 mt-0.5">{selectedTemplate.helpText}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedTemplate(null)} className="text-xs underline opacity-60 hover:opacity-100 shrink-0">Change</button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Date</label>
                      <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Amount (৳)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Description / Notes</label>
                    <input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={`e.g. ${selectedTemplate.name} - July 2026`}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Preview what will be posted */}
                  {amount && parseFloat(amount) > 0 && (
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">What will be recorded</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left py-1 font-medium">Account</th>
                            <th className="text-right py-1 font-medium w-24">Debit</th>
                            <th className="text-right py-1 font-medium w-24">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTemplate.lines.map((l, i) => {
                            const acc = accounts.find(a => a.code === l.accountCode);
                            return (
                              <tr key={i} className="border-t border-border/50">
                                <td className="py-1.5">
                                  <span className="font-mono text-muted-foreground mr-1.5 text-[10px]">{l.accountCode}</span>
                                  <span className="font-medium text-foreground">{acc?.name || l.accountName}</span>
                                  <span className="text-muted-foreground ml-1">— {l.label}</span>
                                </td>
                                <td className="py-1.5 text-right font-semibold text-green-700">{l.role === 'debit' ? formatCurrency(parseFloat(amount)) : '—'}</td>
                                <td className="py-1.5 text-right font-semibold text-red-600">{l.role === 'credit' ? formatCurrency(parseFloat(amount)) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Custom / advanced mode */
            <>
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2 text-xs text-amber-700">
                <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Advanced mode: debits and credits must always balance. For most everyday expenses, use the <button type="button" onClick={() => setMode('templates')} className="underline font-medium">Quick Templates</button> tab instead.</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Entry Date</label>
                  <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description *</label>
                  <input required value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Monthly rent payment" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium">Line Items</label>
                  <button type="button" onClick={addLine} className="text-xs text-blue-600 hover:underline">+ Add Line</button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Account</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Debit (৳)</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Credit (৳)</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Note</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map((line, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">
                            <select
                              value={line.accountId}
                              onChange={e => updateLine(i, 'accountId', e.target.value)}
                              className="w-full border border-border rounded px-2 py-1 text-xs focus:outline-none"
                            >
                              <option value="">Select account</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" placeholder="0.00" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} className="w-full border border-border rounded px-2 py-1 text-xs text-right focus:outline-none" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" placeholder="0.00" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} className="w-full border border-border rounded px-2 py-1 text-xs text-right focus:outline-none" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input placeholder="Optional" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} className="w-full border border-border rounded px-2 py-1 text-xs focus:outline-none" />
                          </td>
                          <td className="px-1 py-1.5">
                            {lines.length > 2 && (
                              <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg text-xs ${isBalanced && totalDebit > 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                <div>
                  <span className="text-muted-foreground">Debit: </span>
                  <span className="font-semibold text-green-700">{formatCurrency(totalDebit)}</span>
                  <span className="mx-3 text-muted-foreground">Credit: </span>
                  <span className="font-semibold text-red-600">{formatCurrency(totalCredit)}</span>
                </div>
                <span className={`font-semibold ${isBalanced && totalDebit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {isBalanced && totalDebit > 0 ? 'Balanced' : 'Not balanced'}
                </span>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
            <button
              type="submit"
              disabled={saving || (mode === 'templates' && (!selectedTemplate || !amount || parseFloat(amount) <= 0)) || (mode === 'custom' && (!isBalanced || totalDebit === 0))}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
