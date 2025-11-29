'use client';
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

interface LogicNodeData {
    operator: 'AND' | 'OR';
    onEdit?: (id: string, data: LogicNodeData) => void;
}

function LogicNode({ id, data }: NodeProps<LogicNodeData>) {
    return (
        <div 
            className={`border-2 rounded-full shadow-lg p-6 cursor-pointer hover:shadow-2xl transition-shadow ${
                data.operator === 'AND' 
                    ? 'bg-indigo-500 border-indigo-600' 
                    : 'bg-purple-500 border-purple-600'
            }`}
            onDoubleClick={() => data.onEdit?.(id, data)}
        >
            <Handle 
                type="target" 
                position={Position.Left} 
                id="input-1"
                style={{ top: '35%' }}
                className="!bg-white !w-3 !h-3 !border-2 !border-gray-400"
            />
            <Handle 
                type="target" 
                position={Position.Left} 
                id="input-2"
                style={{ top: '65%' }}
                className="!bg-white !w-3 !h-3 !border-2 !border-gray-400"
            />
            <div className="text-white font-bold text-xl">
                {data.operator}
            </div>
            <Handle 
                type="source" 
                position={Position.Right} 
                className="!bg-white !w-3 !h-3 !border-2 !border-gray-400"
            />
        </div>
    );
}

export default memo(LogicNode);
