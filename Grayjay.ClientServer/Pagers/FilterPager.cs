using Grayjay.Engine.Pagers;

namespace Grayjay.ClientServer.Pagers
{
    public class FilterPager<T> : IPager<T>
    {
        private readonly IPager<T> _pager;
        private readonly Func<T, bool> _filter;
        private readonly int _pageSize;
        private readonly Queue<T> _pending = new Queue<T>();

        private bool _currentPageConsumed;
        private T[] _currentResults = new T[0];

        public string ID { get { return _pager.ID; } set { _pager.ID = value; } }

        public FilterPager(IPager<T> pager, Func<T, bool> filter, int pageSize = 10)
        {
            _pager = pager;
            _filter = filter;
            _pageSize = pageSize;
            LoadNextPage();
        }

        public bool HasMorePages()
        {
            return _pending.Count > 0 || _pager.HasMorePages();
        }

        public void NextPage()
        {
            LoadNextPage();
        }

        public T[] GetResults()
        {
            return _currentResults;
        }

        private void LoadNextPage()
        {
            List<T> results = new List<T>();
            while (results.Count < _pageSize)
            {
                while (_pending.Count > 0 && results.Count < _pageSize)
                    results.Add(_pending.Dequeue());

                if (results.Count >= _pageSize || (_currentPageConsumed && !_pager.HasMorePages()))
                    break;

                if (_currentPageConsumed)
                    _pager.NextPage();

                _currentPageConsumed = true;
                foreach (var item in _pager.GetResults())
                {
                    if (_filter(item))
                        _pending.Enqueue(item);
                }
            }

            _currentResults = results.ToArray();
        }
    }
}
