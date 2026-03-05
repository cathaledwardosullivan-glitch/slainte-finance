import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import COLORS from '../utils/colors';

const ModuleSelector = ({ onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const modules = [
        { id: 'finance', name: 'Finance', active: true },
        { id: 'dara', name: 'EHR Support', navigateTo: 'dara-support' },
        { id: 'clinical', name: 'Clinical', comingSoon: true }
    ];

    const handleModuleClick = (module) => {
        if (module.comingSoon) return;
        if (module.navigateTo && onNavigate) {
            onNavigate(module.navigateTo);
            setIsOpen(false);
        } else if (module.id === 'finance' && onNavigate) {
            onNavigate('business-overview');
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-4 py-2 text-sm border rounded-lg transition-colors"
                style={{
                    color: COLORS.mediumGray,
                    borderColor: COLORS.lightGray,
                    backgroundColor: COLORS.white
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.white}
            >
                <span>Modules</span>
                <ChevronDown className="h-4 w-4" />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50"
                    style={{
                        backgroundColor: COLORS.white,
                        borderColor: COLORS.lightGray
                    }}
                >
                    <div className="py-1">
                        {modules.map((module) => (
                            <div
                                key={module.id}
                                className={`px-4 py-2 text-sm ${module.comingSoon ? 'cursor-not-allowed' : 'cursor-pointer'
                                    }`}
                                style={{
                                    backgroundColor: module.active ? COLORS.slainteBlue : 'transparent',
                                    color: module.active ? COLORS.white : module.comingSoon ? COLORS.lightGray : COLORS.darkGray
                                }}
                                onClick={() => handleModuleClick(module)}
                                onMouseEnter={(e) => {
                                    if (!module.active && !module.comingSoon) {
                                        e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!module.active) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{module.id === 'dara' ? 'Dara IT Support (BETA)' : `Slainte ${module.name}`}</span>
                                    {module.comingSoon && (
                                        <span
                                            className="text-xs px-2 py-0.5 rounded"
                                            style={{
                                                backgroundColor: COLORS.lightGray,
                                                color: COLORS.mediumGray
                                            }}
                                        >
                                            Soon
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModuleSelector;
