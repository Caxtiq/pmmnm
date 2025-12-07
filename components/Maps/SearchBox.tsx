/*
 * Copyright 2025 PKA-OpenLD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';
import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

interface SearchResult {
  ref_id: string;
  distance: number;
  address: string;
  name: string;
  display: string;
  boundaries: Array<{
    type: number;
    id: number;
    name: string;
    prefix: string;
    full_name: string;
  }>;
  categories: string[];
  entry_points: Array<{
    ref_id: string;
    name: string;
  }>;
}

interface SearchBoxProps {
  onSelectLocation: (refId: string, display: string) => void;
  mapCenter?: [number, number];
}

export default function SearchBox({ onSelectLocation, mapCenter }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(query);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, mapCenter]);

  const searchLocations = async (searchText: string) => {
    setIsLoading(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
      let url = `https://maps.vietmap.vn/api/autocomplete/v4?apikey=${apiKey}&text=${encodeURIComponent(searchText)}&display_type=1`;
      
      if (mapCenter) {
        url += `&focus=${mapCenter[1]},${mapCenter[0]}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setResults(data);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    onSelectLocation(result.ref_id, result.display);
    setQuery(result.display);
    setShowResults(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div ref={searchBoxRef} className="relative w-96">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Tìm kiếm địa điểm..."
          className="w-full px-4 py-2.5 pl-10 pr-10 text-sm text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 shadow-lg transition-all placeholder:text-gray-400"
        />
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"
        />
        {isLoading && (
          <FontAwesomeIcon
            icon={faSpinner}
            spin
            className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-blue-500 text-sm"
          />
        )}
        {query && !isLoading && (
          <button
            onClick={handleClear}
            className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="text-sm" />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div 
          className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl max-h-80 overflow-y-auto border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            animation: 'slideDown 0.2s ease-out'
          }}
        >
          {results.map((result, index) => (
            <button
              key={`${result.ref_id}-${index}`}
              onClick={() => handleSelectResult(result)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-50 last:border-b-0 transition-all duration-200 group"
              style={{
                animation: `fadeInUp 0.3s ease-out ${index * 0.03}s backwards`
              }}
            >
              <div className="font-semibold text-sm text-black group-hover:text-blue-600 transition-colors duration-200">{result.name}</div>
              <div className="text-xs text-gray-600 mt-0.5 line-clamp-1">{result.address}</div>
              {result.distance > 0 && (
                <div className="text-xs text-blue-600 mt-1 font-medium">
                  📍 {result.distance.toFixed(2)} km
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
