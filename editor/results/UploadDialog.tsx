import React from 'react';
import { useT } from '../../lib/phrases/results';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, Modal } from '../components/Modal';
import { UploadPlan } from './uploads';

interface Props {
  title: string;
  plan: UploadPlan;
  onConfirm: () => void;
  onClose: () => void;
}

const List: React.FC<{ names: string[] }> = ({ names }) => (
  <ul className="max-h-40 overflow-y-auto rounded border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700">
    {names.map((name) => (
      <li key={name} className="truncate" title={name}>
        {name}
      </li>
    ))}
  </ul>
);

/** What files dropped on a paper's page will do, before they are uploaded. */
const UploadDialog: React.FC<Props> = ({ title, plan, onConfirm, onClose }) => {
  const t = useT();
  const names = Object.keys(plan.files).sort();
  const { type, size, count } = plan.skipped;
  return (
    <Modal
      title={t('上传到「{title}」', { title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            {t('取消')}
          </button>
          <button type="button" disabled={names.length === 0} onClick={onConfirm} className={BUTTON_PRIMARY}>
            {plan.replaced.length > 0 ? t('上传并覆盖') : t('上传')}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-gray-700">
        {names.length > 0 ? (
          <div className="space-y-1">
            <p>{t('{n} 个文件会上传到这篇论文的附件，文件夹保留原样：', { n: names.length })}</p>
            <List names={names} />
          </div>
        ) : (
          <p>{t('没有可以上传的文件。')}</p>
        )}
        {plan.replaced.length > 0 && (
          <div className="space-y-1">
            <p className="text-amber-700">{t('其中 {n} 个会覆盖同名的附件，用到它们的块会重新编译：', { n: plan.replaced.length })}</p>
            <List names={plan.replaced} />
          </div>
        )}
        {type.length > 0 && (
          <div className="space-y-1">
            <p className="text-gray-500">{t('跳过 {n} 个编译用不到的文件（只收 PDF、PNG、JPG、.tex、.bib、.sty、.cls 等）：', { n: type.length })}</p>
            <List names={type} />
          </div>
        )}
        {size.length > 0 && (
          <div className="space-y-1">
            <p className="text-gray-500">{t('跳过 {n} 个超过 20 MB 的文件：', { n: size.length })}</p>
            <List names={size} />
          </div>
        )}
        {count.length > 0 && (
          <div className="space-y-1">
            <p className="text-gray-500">{t('一次最多上传 {max} 个文件，跳过了其余 {n} 个：', { max: names.length, n: count.length })}</p>
            <List names={count} />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UploadDialog;
