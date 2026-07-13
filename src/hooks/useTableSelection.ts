import { useState } from "react";

type RowId = number | string;

export function useTableSelection<TId extends RowId>(rowIds: TId[]) {
  const [selectedRows, setSelectedRows] = useState<TId[]>([]);

  function toggleRow(id: TId) {
    setSelectedRows((current) =>
      current.includes(id)
        ? current.filter((rowId) => rowId !== id)
        : [...current, id]
    );
  }

  function toggleAll() {
    setSelectedRows((current) =>
      current.length === rowIds.length ? [] : rowIds
    );
  }

  return {
    selectedRows,
    selectedCount: selectedRows.length,
    allSelected: selectedRows.length === rowIds.length && rowIds.length > 0,
    toggleRow,
    toggleAll,
  };
}
