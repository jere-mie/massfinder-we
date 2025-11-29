import { useState } from "react";

export default function Sample() {
    const [count, setCount] = useState(0);
    return (
        <div className="max-w-md mx-auto my-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-4">
            <div className="flex-none w-12 h-12 rounded-lg bg-linear-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold">
                S
            </div>
            <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sample Component</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                This is a sample component in TypeScript React.
                </p>
            </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm shadow-sm" onClick={() => setCount(count + 1)}>
                Clicked {count} {count === 1 ? 'time' : 'times'}
            </button>
            </div>
        </div>
    );
}